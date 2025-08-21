export class Review {
  _id: string;
  productId: string;
  customerId: string;
  orderId: string;
  rating: number;
  title: string;
  comment: string;
  reviewDate: Date;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: Date;
  response?: string;
  responseDate?: Date;
  helpfulCount: number;
  isVerifiedPurchase: boolean;
  images: string[];
  createdAt: Date;
  updatedAt: Date;
}
