import { ApiProperty } from '@nestjs/swagger';
import { Notification, NotificationType } from '@prisma/client';

export class NotificationDto {
  @ApiProperty() id: string;
  @ApiProperty() userId: string;
  @ApiProperty({ enum: NotificationType }) type: NotificationType;
  @ApiProperty() title: string;
  @ApiProperty() message: string;
  @ApiProperty() isRead: boolean;
  @ApiProperty() createdAt: Date;
}

export function toNotificationDto(notification: Notification): NotificationDto {
  return {
    id: notification.id,
    userId: notification.userId,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    isRead: notification.isRead,
    createdAt: notification.createdAt
  };
}
