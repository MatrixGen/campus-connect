import { Sequelize, Op } from 'sequelize';
import sequelize from '../config/database';
import User from './User';
import Runner from './Runner';
import Errand from './Errand';
import Transaction from './Transaction';
import Review from './Review';

// Define associations
User.hasOne(Runner, {
  foreignKey: 'user_id',
  as: 'runner_profile',
  onDelete: 'CASCADE'
});

Runner.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user'
});

// User-Errand associations
User.hasMany(Errand, {
  foreignKey: 'customer_id',
  as: 'customer_errands'
});

User.hasMany(Errand, {
  foreignKey: 'runner_id',
  as: 'runner_errands'
});

Errand.belongsTo(User, {
  foreignKey: 'customer_id',
  as: 'customer'
});

Errand.belongsTo(User, {
  foreignKey: 'runner_id',
  as: 'runner'
});

// Errand-Transaction association
Errand.hasOne(Transaction, {
  foreignKey: 'errand_id',
  as: 'transaction'
});

Transaction.belongsTo(Errand, {
  foreignKey: 'errand_id',
  as: 'errand'
});

// User-Transaction associations
User.hasMany(Transaction, {
  foreignKey: 'customer_id',
  as: 'customer_transactions'
});

User.hasMany(Transaction, {
  foreignKey: 'runner_id',
  as: 'runner_transactions'
});

Transaction.belongsTo(User, {
  foreignKey: 'customer_id',
  as: 'customer'
});

Transaction.belongsTo(User, {
  foreignKey: 'runner_id',
  as: 'runner'
});

// Review associations
Errand.hasOne(Review, {
  foreignKey: 'errand_id',
  as: 'review'
});

Review.belongsTo(Errand, {
  foreignKey: 'errand_id',
  as: 'errand'
});

User.hasMany(Review, {
  foreignKey: 'reviewer_id',
  as: 'given_reviews'
});

User.hasMany(Review, {
  foreignKey: 'reviewee_id',
  as: 'received_reviews'
});

Review.belongsTo(User, {
  foreignKey: 'reviewer_id',
  as: 'reviewer'
});

Review.belongsTo(User, {
  foreignKey: 'reviewee_id',
  as: 'reviewee'
});

// Cancelled by association
Errand.belongsTo(User, {
  foreignKey: 'cancelled_by',
  as: 'cancelled_by_user'
});

const models = {
  User,
  Runner,
  Errand,
  Transaction,
  Review,
  sequelize,
  Sequelize, // Add Sequelize class
  Op // Add Op for operators
};

export default models;