import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { Document } from 'mongoose';

export type CustomerDocument = Customer & Document;

@Schema({
  timestamps: true, // Tự động thêm createdAt và updatedAt
  collection: 'customers',
})
export class Customer {
  @ApiProperty({
    description: 'ID khách hàng (MongoDB ObjectId)',
    example: '60d5f484e1a2f5001f647abc',
  })
  _id: string;

  @Prop({
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 100,
  })
  @ApiProperty({
    description: 'Họ và tên đầy đủ của khách hàng',
    example: 'Nguyễn Văn An',
    minLength: 2,
    maxLength: 100,
  })
  fullName: string;

  @Prop({
    required: true,
    unique: true,
    match: /^[0-9]{10,11}$/,
  })
  @ApiProperty({
    description: 'Số điện thoại khách hàng (10-11 chữ số)',
    example: '0987654321',
    pattern: '^[0-9]{10,11}$',
  })
  phone: string;

  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  })
  @ApiProperty({
    description: 'Email khách hàng (duy nhất)',
    example: 'nguyenvana@email.com',
    format: 'email',
  })
  email: string;

  @Prop({
    required: true,
    minlength: 6,
  })
  @ApiProperty({
    description: 'Mật khẩu đã được hash',
    example: '$2b$12$hashedPassword...',
    writeOnly: true,
  })
  password: string;

  @Prop({
    trim: true,
    maxlength: 500,
  })
  @ApiProperty({
    description: 'Địa chỉ khách hàng',
    example: '123 Nguyễn Trãi, Phường 2, Quận 5, TP.HCM',
    maxLength: 500,
    required: false,
  })
  address?: string;

  @Prop({
    type: Boolean,
    default: false,
  })
  @ApiProperty({
    description: 'Tài khoản bị khóa (không thể đăng nhập)',
    example: false,
    default: false,
  })
  isLocked?: boolean;

  @Prop({
    type: Boolean,
    default: false,
  })
  @ApiProperty({
    description: 'Bị khóa bình luận (không thể bình luận sản phẩm)',
    example: false,
    default: false,
    required: false,
  })
  isCommentLocked?: boolean;

  @Prop({
    type: String,
    default: null,
  })
  @ApiProperty({
    description: 'Token để reset mật khẩu',
    example: 'abc123def456...',
    required: false,
  })
  resetPasswordToken?: string;

  @Prop({
    type: Date,
    default: null,
  })
  @ApiProperty({
    description: 'Thời gian hết hạn token reset mật khẩu',
    example: '2024-01-01T01:00:00.000Z',
    required: false,
  })
  resetPasswordExpires?: Date;

  @ApiProperty({
    description: 'Thời gian tạo tài khoản',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Thời gian cập nhật cuối cùng',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt: Date;
}

export const CustomerSchema = SchemaFactory.createForClass(Customer);

// Indexes
CustomerSchema.index({ email: 1 }, { unique: true });
CustomerSchema.index({ phone: 1 }, { unique: true });
CustomerSchema.index({ createdAt: -1 });

// Virtual for id field
CustomerSchema.virtual('id').get(function () {
  return this._id.toString();
});

// Transform to JSON
CustomerSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret.password; // Không trả về password trong response
    return ret;
  },
});
