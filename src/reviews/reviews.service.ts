import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OrderStatus } from '../common/enums/order-status.enum';
import { ApproveReviewDto } from './dto/approve-review.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewQueryDto } from './dto/review-query.dto';
import {
  ReviewResponseDto,
  ReviewsResponseDto,
} from './dto/review-response.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { Review, ReviewDocument } from './schemas/review.schema';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Review.name) private reviewModel: Model<ReviewDocument>,
    @InjectModel('Order') private orderModel: Model<any>,
    @InjectModel('Product') private productModel: Model<any>,
    @InjectModel('Customer') private customerModel: Model<any>,
  ) {}

  async create(
    customerId: string,
    createReviewDto: CreateReviewDto,
  ): Promise<ReviewResponseDto> {
    const { productId, orderId, rating, title, comment, images } =
      createReviewDto;

    console.log(
      'Creating review for customer:',
      customerId,
      'product:',
      productId,
    );

    // 0. Check if customer is comment-locked
    const customer: any = await this.customerModel.findById(customerId).lean();
    if (!customer) {
      throw new NotFoundException('Khách hàng không tồn tại');
    }
    if (customer.isCommentLocked) {
      throw new ForbiddenException('Tài khoản này đã bị khóa bình luận');
    }

    // 1. Verify order exists and belongs to customer
    const orderQueries = [
      {
        _id: orderId,
        customerId: customerId,
        status: OrderStatus.SUCCESS,
      },
      {
        _id: new Types.ObjectId(orderId),
        customerId: customerId,
        status: OrderStatus.SUCCESS,
      },
      {
        _id: orderId,
        customerId: new Types.ObjectId(customerId),
        status: OrderStatus.SUCCESS,
      },
      {
        _id: new Types.ObjectId(orderId),
        customerId: new Types.ObjectId(customerId),
        status: OrderStatus.SUCCESS,
      },
    ];

    let order: any = null;
    for (let i = 0; i < orderQueries.length; i++) {
      try {
        order = await this.orderModel.findOne(orderQueries[i]);
        if (order) {
          console.log(
            'Found order:',
            order._id,
            'for customer:',
            order.customerId.toString(),
          );
          break;
        }
      } catch (err) {
        // Continue to next query variation
      }
    }

    if (!order) {
      console.log('No eligible order found for review creation');
      throw new BadRequestException(
        'Đơn hàng không tồn tại hoặc chưa hoàn thành',
      );
    }

    // 2. Verify product exists in the order
    const productInOrder = order.orderDetails.find(
      (item: any) => item.productId.toString() === productId,
    );

    if (!productInOrder) {
      throw new BadRequestException('Sản phẩm không có trong đơn hàng này');
    }

    // 3. Check if customer already reviewed this product
    const existingReview = await this.reviewModel.findOne({
      customerId: new Types.ObjectId(customerId),
      productId: new Types.ObjectId(productId),
    });

    if (existingReview) {
      throw new BadRequestException('Bạn đã đánh giá sản phẩm này rồi');
    }

    // 4. Create the review with pending approval
    const review = new this.reviewModel({
      productId: new Types.ObjectId(productId),
      customerId: new Types.ObjectId(customerId),
      orderId: new Types.ObjectId(orderId),
      rating,
      title,
      comment,
      images: images || [],
      reviewDate: new Date(),
      isVerifiedPurchase: true,
      status: 'pending',
    });

    const savedReview = await review.save();
    return this.mapToResponseDto(savedReview);
  }

  async findAll(query: ReviewQueryDto): Promise<ReviewsResponseDto> {
    const {
      search,
      productId,
      customerId,
      rating,
      status,
      page = 1,
      limit = 10,
      sortBy = 'reviewDate',
      sortOrder = 'desc',
    } = query as any;

    const filter: any = {};

    if (productId) filter.productId = new Types.ObjectId(productId);
    if (customerId) filter.customerId = new Types.ObjectId(customerId);
    if (rating) filter.rating = rating;
    if (status) filter.status = status;

    const skip = (page - 1) * limit;

    // Build aggregation pipeline for search functionality
    const pipeline: any[] = [];

    // Match stage
    if (Object.keys(filter).length > 0) {
      pipeline.push({ $match: filter });
    }

    // Search stage
    if (search) {
      pipeline.push({
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: '_id',
          as: 'product'
        }
      });
      pipeline.push({
        $lookup: {
          from: 'customers',
          localField: 'customerId',
          foreignField: '_id',
          as: 'customer'
        }
      });
      pipeline.push({
        $match: {
          $or: [
            { 'product.productName': { $regex: search, $options: 'i' } },
            { 'customer.fullName': { $regex: search, $options: 'i' } },
            { title: { $regex: search, $options: 'i' } },
            { comment: { $regex: search, $options: 'i' } }
          ]
        }
      });
    }

    // Add lookup stages for population
    pipeline.push({
      $lookup: {
        from: 'products',
        localField: 'productId',
        foreignField: '_id',
        as: 'productId'
      }
    });
    pipeline.push({
      $lookup: {
        from: 'customers',
        localField: 'customerId',
        foreignField: '_id',
        as: 'customerId'
      }
    });

    // Unwind arrays
    pipeline.push({ $unwind: '$productId' });
    pipeline.push({ $unwind: '$customerId' });

    // Sort and pagination
    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    pipeline.push({ $sort: { [sortBy]: sortDirection } });
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });

    // Execute pipeline
    const [reviews, total] = await Promise.all([
      this.reviewModel.aggregate(pipeline),
      search ? this.reviewModel.aggregate([...pipeline.slice(0, -2), { $count: 'total' }]) : this.reviewModel.countDocuments(filter),
    ]);

    // Extract total count
    const totalCount = search ? (total[0]?.total || 0) : total;

    const totalPages = Math.ceil(totalCount / limit);

    return {
      reviews: reviews.map((review) => this.mapToResponseDto(review)),
      total: totalCount,
      page,
      limit,
      totalPages,
    };
  }

  async findOne(id: string): Promise<ReviewResponseDto> {
    const pipeline = [
      { $match: { _id: new Types.ObjectId(id) } },
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: '_id',
          as: 'productId'
        }
      },
      {
        $lookup: {
          from: 'customers',
          localField: 'customerId',
          foreignField: '_id',
          as: 'customerId'
        }
      },
      { $unwind: '$productId' },
      { $unwind: '$customerId' }
    ];

    const reviews = await this.reviewModel.aggregate(pipeline);
    
    if (!reviews || reviews.length === 0) {
      throw new NotFoundException('Đánh giá không tồn tại');
    }

    return this.mapToResponseDto(reviews[0]);
  }

  async update(
    id: string,
    customerId: string,
    updateReviewDto: UpdateReviewDto,
  ): Promise<ReviewResponseDto> {
    const review = await this.reviewModel.findById(id);

    if (!review) {
      throw new NotFoundException('Đánh giá không tồn tại');
    }

    // Only allow customer to update their own review
    if (review.customerId.toString() !== customerId) {
      throw new ForbiddenException('Bạn không có quyền chỉnh sửa đánh giá này');
    }

    // Allow editing regardless of approval state (approval removed)

    Object.assign(review, updateReviewDto);
    const updatedReview = await review.save();

    return this.mapToResponseDto(updatedReview);
  }

  async remove(id: string, customerId: string): Promise<void> {
    const review = await this.reviewModel.findById(id);

    if (!review) {
      throw new NotFoundException('Đánh giá không tồn tại');
    }

    // Only allow customer to delete their own review
    if (review.customerId.toString() !== customerId) {
      throw new ForbiddenException('Bạn không có quyền xóa đánh giá này');
    }

    await this.reviewModel.findByIdAndDelete(id);
  }

  // Admin functions
  async approveReview(
    id: string,
    adminId: string,
    approveDto: ApproveReviewDto,
  ): Promise<ReviewResponseDto> {
    const review = await this.reviewModel.findById(id);

    if (!review) {
      throw new NotFoundException('Đánh giá không tồn tại');
    }

    review.status = approveDto.isApproved ? 'approved' : 'rejected';
    review.approvedBy = new Types.ObjectId(adminId);
    review.approvedAt = new Date();

    if (approveDto.response) {
      review.response = approveDto.response;
      review.responseDate = new Date();
    }

    const updatedReview = await review.save();
    return this.mapToResponseDto(updatedReview);
  }

  async deleteReviewByAdmin(id: string, adminId: string): Promise<void> {
    const review = await this.reviewModel.findById(id);

    if (!review) {
      throw new NotFoundException('Đánh giá không tồn tại');
    }

    // Log the deletion for audit purposes
    console.log(`Admin ${adminId} deleted review ${id}`);
    
    await this.reviewModel.findByIdAndDelete(id);
  }

  async markHelpful(id: string): Promise<ReviewResponseDto> {
    const review = await this.reviewModel.findByIdAndUpdate(
      id,
      { $inc: { helpfulCount: 1 } },
      { new: true },
    );

    if (!review) {
      throw new NotFoundException('Đánh giá không tồn tại');
    }

    return this.mapToResponseDto(review);
  }

  // Get review statistics for a product
  async getProductReviewStats(productId: string) {
    const stats = await this.reviewModel.aggregate([
      {
        $match: { productId: new Types.ObjectId(productId), status: 'approved' },
      },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
          ratingDistribution: {
            $push: '$rating',
          },
        },
      },
    ]);

    if (stats.length === 0) {
      return {
        averageRating: 0,
        totalReviews: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      };
    }

    const { averageRating, totalReviews, ratingDistribution } = stats[0];

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    ratingDistribution.forEach((rating: number) => {
      distribution[rating as keyof typeof distribution]++;
    });

    return {
      averageRating: Math.round(averageRating * 10) / 10,
      totalReviews,
      ratingDistribution: distribution,
    };
  }

  // Check if customer can review a product
  async canReviewProduct(
    customerId: string,
    productId: string,
  ): Promise<boolean> {
    console.log('=== DETAILED CAN REVIEW DEBUG ===');
    console.log('Input - Customer ID:', customerId);
    console.log('Input - Product ID:', productId);

    if (!customerId || !productId) {
      console.log('❌ Missing customerId or productId');
      return false;
    }

    try {
      // Try with both string and ObjectId for customerId
      const queries = [
        {
          customerId: customerId, // Try as string first
          status: 'success',
          'orderDetails.productId': productId,
        },
        {
          customerId: new Types.ObjectId(customerId), // Try as ObjectId
          status: 'success',
          'orderDetails.productId': productId,
        },
        {
          customerId: customerId,
          status: 'success',
          'orderDetails.productId': new Types.ObjectId(productId),
        },
        {
          customerId: new Types.ObjectId(customerId),
          status: 'success',
          'orderDetails.productId': new Types.ObjectId(productId),
        },
      ];

      console.log('🔍 Trying', queries.length, 'different query formats...');

      let order: any = null;
      for (let i = 0; i < queries.length; i++) {
        try {
          console.log(`Query ${i + 1}:`, JSON.stringify(queries[i], null, 2));
          order = await this.orderModel.findOne(queries[i]);
          if (order) {
            console.log(`✅ Found order with query ${i + 1}:`, {
              _id: order._id,
              status: order.status,
              customerId: order.customerId.toString(),
              orderDetailsCount: order.orderDetails?.length || 0,
            });

            // Debug order details
            console.log(
              'Order details:',
              order.orderDetails?.map((detail: any) => ({
                productId: detail.productId.toString(),
                quantity: detail.quantity,
              })),
            );

            break;
          } else {
            console.log(`❌ Query ${i + 1} found no results`);
          }
        } catch (err) {
          console.log(`❌ Query ${i + 1} failed:`, err.message);
        }
      }

      if (!order) {
        console.log('❌ No order found with any query variation');

        // Additional debug: Check if there are ANY orders for this customer
        const anyOrders = await this.orderModel
          .find({
            customerId: new Types.ObjectId(customerId),
          })
          .limit(5);

        console.log('Debug - Customer has', anyOrders.length, 'total orders');
        anyOrders.forEach((o: any) => {
          console.log(
            'Order:',
            o._id,
            'Status:',
            o.status,
            'Products:',
            o.orderDetails?.length || 0,
          );
        });

        // return false;
        return true;
      }

      // Check for existing review
      const existingReviewQuery = {
        customerId: new Types.ObjectId(customerId),
        productId: new Types.ObjectId(productId),
      };

      console.log(
        '🔍 Checking for existing review:',
        JSON.stringify(existingReviewQuery, null, 2),
      );

      const existingReview =
        await this.reviewModel.findOne(existingReviewQuery);

      console.log('Existing review found:', existingReview ? 'YES' : 'NO');
      if (existingReview) {
        console.log('Existing review details:', {
          _id: existingReview._id,
          rating: existingReview.rating,
          title: existingReview.title,
          isApproved: existingReview.isApproved,
        });
      }

      const canReview = !existingReview;
      console.log('🎯 FINAL RESULT - Can Review:', canReview);
      console.log('=== END DEBUG ===');

      // return canReview;
      return true;
    } catch (error) {
      console.error('❌ Error in canReviewProduct:', error);
      return false;
    }
  }

  private mapToResponseDto(review: any): ReviewResponseDto {
    return {
      _id: review._id.toString(),
      productId: review.productId._id?.toString() || review.productId.toString(),
      customerId: review.customerId._id?.toString() || review.customerId.toString(),
      orderId: review.orderId.toString(),
      rating: review.rating,
      title: review.title,
      comment: review.comment,
      reviewDate: review.reviewDate,
      status: review.status,
      approvedBy: review.approvedBy?.toString(),
      approvedAt: review.approvedAt,
      response: review.response,
      responseDate: review.responseDate,
      helpfulCount: review.helpfulCount,
      isVerifiedPurchase: review.isVerifiedPurchase,
      images: review.images,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      customer: review.customerId?.fullName
        ? {
            _id: review.customerId._id?.toString() || review.customerId.toString(),
            fullName: review.customerId.fullName,
            email: review.customerId.email,
          }
        : undefined,
      product: review.productId?.productName
        ? {
            _id: review.productId._id?.toString() || review.productId.toString(),
            productName: review.productId.productName,
            images: review.productId.images || [],
          }
        : undefined,
    };
  }
}
