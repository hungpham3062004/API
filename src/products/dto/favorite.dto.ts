import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsOptional, IsBoolean } from 'class-validator';

export class CreateFavoriteDto {
  @ApiProperty({ description: 'Product ID' })
  @IsMongoId()
  productId: string;

  @ApiProperty({ description: 'Customer ID' })
  @IsMongoId()
  customerId: string;
}

export class RemoveFavoriteDto {
  @ApiProperty({ description: 'Product ID' })
  @IsMongoId()
  productId: string;

  @ApiProperty({ description: 'Customer ID' })
  @IsMongoId()
  customerId: string;
}

export class FavoriteProductDto {
  @ApiProperty()
  _id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  images: string[];

  @ApiProperty()
  price: number;

  @ApiProperty()
  categoryId?: {
    _id: string;
    name: string;
  };
}

export class FavoriteCustomerDto {
  @ApiProperty()
  _id: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  phone?: string;
}

export class FavoriteResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  productId: FavoriteProductDto;

  @ApiProperty()
  customerId: FavoriteCustomerDto;

  @ApiProperty()
  addedAt: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

export class FavoritesResponseDto {
  @ApiProperty({ type: [FavoriteResponseDto] })
  favorites: FavoriteResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  totalPages: number;

  @ApiProperty()
  currentPage: number;
}

export class CheckFavoriteResponseDto {
  @ApiProperty()
  isFavorite: boolean;
}

export class FavoriteStatsDto {
  @ApiProperty()
  totalFavorites: number;

  @ApiProperty()
  uniqueCustomers: number;

  @ApiProperty()
  uniqueProducts: number;

  @ApiProperty()
  totalValue: number;

  @ApiProperty()
  mostPopularProducts: Array<{
    productId: string;
    productName: string;
    favoriteCount: number;
    totalValue: number;
  }>;
}
