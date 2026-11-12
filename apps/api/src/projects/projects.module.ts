import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { GithubService } from './github.service';
import { DevLogService } from './devlog.service';
@Module({ controllers: [ProjectsController], providers: [ProjectsService, GithubService, DevLogService], exports: [DevLogService] })
export class ProjectsModule {}
