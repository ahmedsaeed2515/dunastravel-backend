import { Controller, Get, Post, Delete, Param, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WishlistService } from './wishlist.service';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators';

@ApiTags('Wishlist')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get('auth/favorites')
  @ApiOperation({ summary: 'Get user favorites' })
  async getFavorites(@CurrentUser() user: any) {
    return this.wishlistService.getFavorites(user.id);
  }

  @Post('tours/:tourId/favorite')
  @HttpCode(201)
  @ApiOperation({ summary: 'Add a tour to favorites' })
  async addFavorite(@CurrentUser() user: any, @Param('tourId') tourId: string) {
    return this.wishlistService.addFavorite(user.id, tourId);
  }

  @Delete('tours/:tourId/favorite')
  @HttpCode(200)
  @ApiOperation({ summary: 'Remove a tour from favorites' })
  async removeFavorite(@CurrentUser() user: any, @Param('tourId') tourId: string) {
    return this.wishlistService.removeFavorite(user.id, tourId);
  }
}
