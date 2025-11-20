import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import User from './User';

interface RunnerAttributes {
  id: number;
  user_id: number;
  areas_covered: string[]; // ['hostel_area', 'library', 'town_center']
  transportation_mode: string;
  is_available: boolean;
  rating: number;
  completed_errands: number;
  earnings: number;
  created_at: Date;
  updated_at: Date;
}

interface RunnerCreationAttributes extends Optional<RunnerAttributes, 'id' | 'is_available' | 'rating' | 'completed_errands' | 'earnings' | 'created_at' | 'updated_at'> {}

class Runner extends Model<RunnerAttributes, RunnerCreationAttributes> implements RunnerAttributes {
  public id!: number;
  public user_id!: number;
  public areas_covered!: string[];
  public transportation_mode!: string;
  public is_available!: boolean;
  public rating!: number;
  public completed_errands!: number;
  public earnings!: number;
  public created_at!: Date;
  public updated_at!: Date;

  // Associations will be defined after initialization
}

Runner.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    areas_covered: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    transportation_mode: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    is_available: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    rating: {
      type: DataTypes.DECIMAL(3, 2),
      defaultValue: 5.0,
      validate: {
        min: 0,
        max: 5,
      },
    },
    completed_errands: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    earnings: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.0,
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
    tableName: 'runners',
    timestamps: true,
    underscored: true,
  }
);

export default Runner;