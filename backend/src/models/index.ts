import sequelize from '../config/database';
import User from './User';
import Runner from './Runner';
import Errand from './Errand';
import Transaction from './Transaction';
import Review from './Review';

// User - Runner Association (One-to-One)
User.hasOne(Runner, {
  foreignKey: 'user_id',
  as: 'runner_profile',
});

Runner.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

// User - Errands Associations
User.hasMany(Errand, {
  foreignKey: 'customer_id',
  as: 'requested_errands',
});

User.hasMany(Errand, {
  foreignKey: 'runner_id',
  as: 'accepted_errands',
});

Errand.belongsTo(User, {
  foreignKey: 'customer_id',
  as: 'customer',
});

Errand.belongsTo(User, {
  foreignKey: 'runner_id',
  as: 'runner',
});

// Errand - Transaction Association (One-to-One)
Errand.hasOne(Transaction, {
  foreignKey: 'errand_id',
  as: 'transaction',
});

Transaction.belongsTo(Errand, {
  foreignKey: 'errand_id',
  as: 'errand',
});

// Review Associations
Errand.hasOne(Review, {
  foreignKey: 'errand_id',
  as: 'review',
});

Review.belongsTo(Errand, {
  foreignKey: 'errand_id',
  as: 'errand',
});

User.hasMany(Review, {
  foreignKey: 'reviewer_id',
  as: 'reviews_given',
});

User.hasMany(Review, {
  foreignKey: 'reviewee_id',
  as: 'reviews_received',
});

Review.belongsTo(User, {
  foreignKey: 'reviewer_id',
  as: 'reviewer',
});

Review.belongsTo(User, {
  foreignKey: 'reviewee_id',
  as: 'reviewee',
});

const models = {
  User,
  Runner,
  Errand,
  Transaction,
  Review,
  sequelize,
};

export type Models = typeof models;

export default models;