import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Favorite, FavoriteDocument } from './schemas/favorite.schema';
import { Product, ProductDocument } from './schemas/product.schema';
import { Customer, CustomerDocument } from '../customers/schemas/customer.schema';
import {
  CreateFavoriteDto,
  RemoveFavoriteDto,
  FavoriteResponseDto,
  FavoritesResponseDto,
  CheckFavoriteResponseDto,
  FavoriteStatsDto,
} from './dto/favorite.dto';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectModel(Favorite.name) private favoriteModel: Model<FavoriteDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
  ) {}

  async addToFavorites(createFavoriteDto: CreateFavoriteDto): Promise<FavoriteResponseDto> {
    const { customerId, productId } = createFavoriteDto;

    // Check if customer exists
    const customer = await this.customerModel.findById(customerId);
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // Check if product exists
    const product = await this.productModel.findById(productId);
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Check if already favorited
    const existingFavorite = await this.favoriteModel.findOne({
      customerId: new Types.ObjectId(customerId),
      productId: new Types.ObjectId(productId),
    });

    if (existingFavorite) {
      if (existingFavorite.isActive) {
        throw new ConflictException('Product is already in favorites');
      } else {
        // Reactivate existing favorite
        existingFavorite.isActive = true;
        existingFavorite.addedAt = new Date();
        const reactivatedFavorite = await existingFavorite.save();
        return this.getFavoriteWithPopulatedData((reactivatedFavorite._id as any).toString());
      }
    }

    // Create new favorite
    const newFavorite = new this.favoriteModel({
      customerId: new Types.ObjectId(customerId),
      productId: new Types.ObjectId(productId),
      addedAt: new Date(),
      isActive: true,
    });

    const savedFavorite = await newFavorite.save();
    return this.getFavoriteWithPopulatedData((savedFavorite._id as any).toString());
  }

  /**
   * Add a product to a customer's favorites without creating duplicates.
   * If the favorite already exists and is inactive, it will be reactivated.
   * Returns the customer's latest favorites list after the operation.
   */
  async addFavoriteProduct(
    customerId: string,
    productId: string,
  ): Promise<FavoritesResponseDto> {
    // Validate customer and product existence
    const [customer, product] = await Promise.all([
      this.customerModel.findById(customerId),
      this.productModel.findById(productId),
    ]);

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Check existing favorite
    const existingFavorite = await this.favoriteModel.findOne({
      customerId: new Types.ObjectId(customerId),
      productId: new Types.ObjectId(productId),
    });

    if (existingFavorite) {
      if (!existingFavorite.isActive) {
        existingFavorite.isActive = true;
        existingFavorite.addedAt = new Date();
        await existingFavorite.save();
      }
      // If already active, no-op
    } else {
      // Create new favorite
      await this.favoriteModel.create({
        customerId: new Types.ObjectId(customerId),
        productId: new Types.ObjectId(productId),
        addedAt: new Date(),
        isActive: true,
      });
    }

    // Return latest favorites list (page 1, newest first)
    return this.getCustomerFavorites(customerId, 1, 50, undefined, 'addedAt', 'desc');
  }

  async removeFromFavorites(removeFavoriteDto: RemoveFavoriteDto): Promise<void> {
    const { customerId, productId } = removeFavoriteDto;

    const result = await this.favoriteModel.updateOne(
      {
        customerId: new Types.ObjectId(customerId),
        productId: new Types.ObjectId(productId),
      },
      { isActive: false }
    );

    if (result.matchedCount === 0) {
      throw new NotFoundException('Favorite not found');
    }
  }

  async getCustomerFavorites(
    customerId: string,
    page: number = 1,
    limit: number = 10,
    search?: string,
    sortBy: string = 'addedAt',
    sortOrder: 'asc' | 'desc' = 'desc',
  ): Promise<FavoritesResponseDto> {
    const skip = (page - 1) * limit;
    const sort: any = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    let query: any = {
      customerId: new Types.ObjectId(customerId),
      isActive: true,
    };

    // Add search functionality
    if (search) {
      query['productId'] = {
        $in: await this.productModel
          .find({
            productName: { $regex: search, $options: 'i' },
          })
          .distinct('_id'),
      };
    }

    const [favorites, total] = await Promise.all([
      this.favoriteModel
        .find(query)
        .populate({
          path: 'productId',
          select: 'productName images price categoryId',
          populate: {
            path: 'categoryId',
            select: 'categoryName',
          },
        })
        .populate({
          path: 'customerId',
          select: 'fullName email phone',
        })
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      this.favoriteModel.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      favorites: favorites.map(favorite => ({
        id: favorite._id.toString(),
        productId: favorite.productId as any,
        customerId: favorite.customerId as any,
        addedAt: favorite.addedAt.toISOString(),
        isActive: favorite.isActive,
        createdAt: (favorite as any).createdAt?.toISOString() || new Date().toISOString(),
        updatedAt: (favorite as any).updatedAt?.toISOString() || new Date().toISOString(),
      })),
      total,
      totalPages,
      currentPage: page,
    };
  }

  async checkFavorite(productId: string, customerId: string): Promise<CheckFavoriteResponseDto> {
    const favorite = await this.favoriteModel.findOne({
      customerId: new Types.ObjectId(customerId),
      productId: new Types.ObjectId(productId),
      isActive: true,
    });

    return {
      isFavorite: !!favorite,
    };
  }

  async getFavoriteStats(): Promise<FavoriteStatsDto> {
    const [
      totalFavorites,
      uniqueCustomers,
      uniqueProducts,
      totalValue,
      mostPopularProducts,
    ] = await Promise.all([
      this.favoriteModel.countDocuments({ isActive: true }),
      this.favoriteModel.distinct('customerId', { isActive: true }).then(ids => ids.length),
      this.favoriteModel.distinct('productId', { isActive: true }).then(ids => ids.length),
      this.favoriteModel.aggregate([
        { $match: { isActive: true } },
        {
          $lookup: {
            from: 'products',
            localField: 'productId',
            foreignField: '_id',
            as: 'product',
          },
        },
        { $unwind: '$product' },
        {
          $group: {
            _id: null,
            totalValue: { $sum: '$product.price' },
          },
        },
      ]),
      this.favoriteModel.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: '$productId',
            favoriteCount: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'product',
          },
        },
        { $unwind: '$product' },
        {
          $project: {
            productId: '$_id',
            productName: '$product.productName',
            favoriteCount: 1,
            totalValue: { $multiply: ['$product.price', '$favoriteCount'] },
          },
        },
        { $sort: { favoriteCount: -1 } },
        { $limit: 10 },
      ]),
    ]);

    return {
      totalFavorites,
      uniqueCustomers,
      uniqueProducts,
      totalValue: totalValue[0]?.totalValue || 0,
      mostPopularProducts,
    };
  }

  private async getFavoriteWithPopulatedData(favoriteId: string): Promise<FavoriteResponseDto> {
    const favorite = await this.favoriteModel
      .findById(favoriteId)
      .populate({
        path: 'productId',
        select: 'productName images price categoryId',
        populate: {
          path: 'categoryId',
          select: 'categoryName',
        },
      })
      .populate({
        path: 'customerId',
        select: 'fullName email phone',
      })
      .lean();

    if (!favorite) {
      throw new NotFoundException('Favorite not found');
    }

    return {
      id: favorite._id.toString(),
      productId: favorite.productId as any,
      customerId: favorite.customerId as any,
      addedAt: favorite.addedAt.toISOString(),
      isActive: favorite.isActive,
      createdAt: (favorite as any).createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: (favorite as any).updatedAt?.toISOString() || new Date().toISOString(),
    };
  }
}
