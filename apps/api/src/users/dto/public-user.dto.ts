import { ApiProperty } from '@nestjs/swagger';
import { User } from '@prisma/client';

export class PublicUser {
  @ApiProperty()
  id: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty({ nullable: true })
  username: string | null;

  @ApiProperty()
  email: string;

  @ApiProperty({ nullable: true })
  avatarUrl: string | null;

  @ApiProperty()
  isAnonymous: boolean;

  @ApiProperty()
  createdAt: Date;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    email: user.email,
    avatarUrl: user.avatarUrl,
    isAnonymous: user.isAnonymous,
    createdAt: user.createdAt
  };
}
