import { Router } from 'express';
import * as PostController from './controller';

const routes = new Router();

routes.route('/posts/:id').get(PostController.fetchPostById);

export default routes;
