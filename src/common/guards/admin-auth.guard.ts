import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as any;

    // Check if user exists and has admin role
    if (user && (user.adminId || user.isAdmin)) {
      return true;
    }

    // Fallback: allow if Authorization header exists (temporary soft guard)
    const authHeader = request.headers['authorization'];
    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return true;
    }

    throw new UnauthorizedException('Admin access required');

  }
}
