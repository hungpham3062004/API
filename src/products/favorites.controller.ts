import {
  Controller,
  Post,
  Delete,
  Get,
  Query,
  Body,
  Param,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FavoritesService } from './favorites.service';
import {
  CreateFavoriteDto,
  RemoveFavoriteDto,
  FavoriteResponseDto,
  FavoritesResponseDto,
  CheckFavoriteResponseDto,
  FavoriteStatsDto,
} from './dto/favorite.dto';

@ApiTags('Favorites')
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Post()
  @ApiOperation({ summary: 'Add product to favorites' })
  @ApiResponse({ status: 201, description: 'Product added to favorites', type: FavoriteResponseDto })
  async addToFavorites(
    @Body() createFavoriteDto: CreateFavoriteDto,
    @Request() req,
  ): Promise<FavoriteResponseDto> {
    return this.favoritesService.addToFavorites(createFavoriteDto);
  }

  @Delete()
  @ApiOperation({ summary: 'Remove product from favorites' })
  @ApiResponse({ status: 200, description: 'Product removed from favorites' })
  async removeFromFavorites(
    @Body() removeFavoriteDto: RemoveFavoriteDto,
  ): Promise<void> {
    return this.favoritesService.removeFromFavorites(removeFavoriteDto);
  }

  @Get('customer/:customerId')
  @ApiOperation({ summary: 'Get customer favorites' })
  @ApiResponse({ status: 200, description: 'Customer favorites', type: FavoritesResponseDto })
  async getCustomerFavorites(
    @Param('customerId') customerId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('search') search?: string,
    @Query('sortBy') sortBy: string = 'addedAt',
    @Query('sortOrder') sortOrder: 'asc' | 'desc' = 'desc',
  ): Promise<FavoritesResponseDto> {
    return this.favoritesService.getCustomerFavorites(
      customerId,
      page,
      limit,
      search,
      sortBy,
      sortOrder,
    );
  }

  @Get('check/:productId/:customerId')
  @ApiOperation({ summary: 'Check if product is favorited by customer' })
  @ApiResponse({ status: 200, description: 'Favorite status', type: CheckFavoriteResponseDto })
  async checkFavorite(
    @Param('productId') productId: string,
    @Param('customerId') customerId: string,
  ): Promise<CheckFavoriteResponseDto> {
    return this.favoritesService.checkFavorite(productId, customerId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get favorites statistics' })
  @ApiResponse({ status: 200, description: 'Favorites statistics', type: FavoriteStatsDto })
  async getFavoriteStats(): Promise<FavoriteStatsDto> {
    return this.favoritesService.getFavoriteStats();
  }
}
