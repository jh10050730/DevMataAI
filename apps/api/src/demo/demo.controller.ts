import { Controller, Delete, Get, Post } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { DemoService } from './demo.service';

@Controller('demo')
export class DemoController {
  constructor(private readonly demo: DemoService) {}

  @Get()
  status(@CurrentUser() user: AuthUser) {
    return this.demo.status(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser) {
    return this.demo.create(user.id);
  }

  @Delete()
  remove(@CurrentUser() user: AuthUser) {
    return this.demo.remove(user.id);
  }
}
