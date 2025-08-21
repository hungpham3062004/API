import { IsOptional, IsMongoId, IsNumber, IsBoolean, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ReviewQueryDto {
  @ApiProperty({ required: false, description: 'Search in product name, customer name, title, or comment' })
  @IsOptional()
  search?: string;

  @ApiProperty({ required: false, description: 'Product ID to filter reviews' })
  @IsOptional()
  @IsMongoId()
  productId?: string;

  @ApiProperty({ required: false, description: 'Customer ID to filter reviews' })
  @IsOptional()
  @IsMongoId()
  customerId?: string;

  @ApiProperty({ required: false, description: 'Filter by rating' })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiProperty({ required: false, description: 'Filter by status', enum: ['pending', 'approved', 'rejected'] })
  @IsOptional()
  status?: 'pending' | 'approved' | 'rejected';

  @ApiProperty({ required: false, description: 'Page number', default: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ required: false, description: 'Items per page', default: 10 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiProperty({ required: false, description: 'Sort by field', default: 'reviewDate' })
  @IsOptional()
  sortBy?: string = 'reviewDate';

  @ApiProperty({ required: false, description: 'Sort order', enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'desc';
}
