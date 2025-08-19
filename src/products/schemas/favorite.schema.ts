import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type FavoriteDocument = Favorite & Document;

@Schema({ timestamps: true })
export class Favorite {
  @Prop({ type: Types.ObjectId, ref: 'Customer', required: true })
  customerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId: Types.ObjectId;

  @Prop({ default: Date.now })
  addedAt: Date;

  @Prop({ default: true })
  isActive: boolean;
}

export const FavoriteSchema = SchemaFactory.createForClass(Favorite);

// Compound index to ensure unique customer-product combinations
FavoriteSchema.index({ customerId: 1, productId: 1 }, { unique: true });
