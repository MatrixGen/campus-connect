import { User } from '../models/User';
import { Errand } from '../models/Errand';

declare module '../models/Errand' {
  interface Errand {
    customer?: User;
  }
}
