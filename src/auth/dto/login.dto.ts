import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'maxifan' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  username!: string;

  @ApiProperty({ example: 'maxifan' })
  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  @MaxLength(80)
  password!: string;
}
