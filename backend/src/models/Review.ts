import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import User from './User';
import Errand from './Errand';

interface ReviewAttributes {
  id: number;
  errand_id: number;
  reviewer_id: number;
  reviewee_id: number;
  rating: number;
  comment?: string;
  type: 'customer_to_runner' | 'runner_to_customer';
  created_at: Date;
  updated_at: Date;
}

interface ReviewCreationAttributes extends Optional<ReviewAttributes, 'id' | 'created_at' | 'updated_at'> {}

class Review extends Model<ReviewAttributes, ReviewCreationAttributes> implements ReviewAttributes {
  public id!: number;
  public errand_id!: number;
  public reviewer_id!: number;
  public reviewee_id!: number;
  public rating!: number;
  public comment?: string;
  public type!: 'customer_to_runner' | 'runner_to_customer';
  public created_at!: Date;
  public updated_at!: Date;
}

Review.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    errand_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'errands',
        key: 'id',
      },
    },
    reviewer_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    reviewee_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    rating: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 5,
      },
    },
    comment: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    type: {
      type: DataTypes.ENUM('customer_to_runner', 'runner_to_customer'),
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'reviews',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['errand_id']
      },
      {
        fields: ['reviewer_id']
      },
      {
        fields: ['reviewee_id']
      },
      {
        fields: ['type']
      },
      {
        fields: ['rating']
      }
    ]
  }
);

export default Review;