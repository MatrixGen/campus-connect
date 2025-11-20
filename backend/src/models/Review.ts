import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import Errand from './Errand';
import User from './User';

interface ReviewAttributes {
  id: number;
  errand_id: number;
  reviewer_id: number;
  reviewee_id: number;
  rating: number;
  comment?: string;
  created_at: Date;
}

interface ReviewCreationAttributes extends Optional<ReviewAttributes, 'id' | 'created_at'> {}

class Review extends Model<ReviewAttributes, ReviewCreationAttributes> implements ReviewAttributes {
  public id!: number;
  public errand_id!: number;
  public reviewer_id!: number;
  public reviewee_id!: number;
  public rating!: number;
  public comment?: string;
  public created_at!: Date;
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
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'reviews',
    timestamps: true,
    underscored: true,
  }
);

export default Review;