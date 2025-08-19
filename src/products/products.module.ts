import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Category,
  CategorySchema,
} from '../categories/schemas/category.schema';
import { Customer, CustomerSchema } from '../customers/schemas/customer.schema';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { Product, ProductSchema } from './schemas/product.schema';
import { Favorite, FavoriteSchema } from './schemas/favorite.schema';
import { FavoritesController } from './favorites.controller';
import { FavoritesService } from './favorites.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Category.name, schema: CategorySchema },
      { name: Customer.name, schema: CustomerSchema },
      { name: Favorite.name, schema: FavoriteSchema },
    ]),
  ],
  controllers: [ProductsController, FavoritesController],
  providers: [ProductsService, FavoritesService],
  exports: [ProductsService, FavoritesService],
})
export class ProductsModule {}
