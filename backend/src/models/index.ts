import { Sequelize, Op } from 'sequelize';
import sequelize from '../config/database';
import User from './User';
import Runner from './Runner';
import Errand from './Errand';
import Transaction from './Transaction';
import Review from './Review';
import Report from './Report'; // Added import

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

// Report Associations - Added after existing ones
User.hasMany(Report, {
  foreignKey: 'reporter_id',
  as: 'reports_made',
});

User.hasMany(Report, {
  foreignKey: 'reported_user_id',
  as: 'reports_received',
});

Report.belongsTo(User, {
  foreignKey: 'reporter_id',
  as: 'reporter',
});

Report.belongsTo(User, {
  foreignKey: 'reported_user_id',
  as: 'reported_user',
});

Report.belongsTo(Errand, {
  foreignKey: 'errand_id',
  as: 'errand',
});

// Updated models export with Report included
const models = {
  User,
  Runner,
  Errand,
  Transaction,
  Review,
  Report, // Added Report
  sequelize,
  Sequelize,
  Op
};

export default models;