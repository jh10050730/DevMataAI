import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { GithubService } from './github.service';
@Module({ controllers: [ProjectsController], providers: [ProjectsService, GithubService] })
export class ProjectsModule {}
