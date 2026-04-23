import { Module } from '@nestjs/common';

import { BlocksModule } from '../blocks/blocks.module';

import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

@Module({
  imports: [BlocksModule],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}
