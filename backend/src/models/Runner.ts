import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import User from './User';

interface RunnerAttributes {
  id: number;
  user_id: number;
  areas_covered: string[]; // ['hostel_area', 'library', 'town_center']
  transportation_mode: string;
  is_available: boolean;
  is_approved: boolean;
  rating: number;
  completed_errands: number;
  earnings: number;
  total_distance_covered: number;
  average_response_time: number; // in minutes
  cancellation_rate: number; // percentage
  documents_verified: boolean;
  id_card_url?: string;
  student_card_url?: string;
  rejection_reason?: string;
  approved_at?: Date;
  last_active_at?: Date;
  created_at: Date;
  updated_at: Date;
}

interface RunnerCreationAttributes extends Optional<RunnerAttributes, 'id' | 'is_available' | 'is_approved' | 'rating' | 'completed_errands' | 'earnings' | 'total_distance_covered' | 'average_response_time' | 'cancellation_rate' | 'documents_verified' | 'created_at' | 'updated_at'> {}

class Runner extends Model<RunnerAttributes, RunnerCreationAttributes> implements RunnerAttributes {
  public id!: number;
  public user_id!: number;
  public areas_covered!: string[];
  public transportation_mode!: string;
  public is_available!: boolean;
  public is_approved!: boolean;
  public rating!: number;
  public completed_errands!: number;
  public earnings!: number;
  public total_distance_covered!: number;
  public average_response_time!: number;
  public cancellation_rate!: number;
  public documents_verified!: boolean;
  public id_card_url?: string;
  public student_card_url?: string;
  public rejection_reason?: string;
  public approved_at?: Date;
  public last_active_at?: Date;
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
      unique: true,
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
    is_approved: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
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
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.0,
    },
    total_distance_covered: {
      type: DataTypes.DECIMAL(8, 2), // in kilometers
      defaultValue: 0.0,
    },
    average_response_time: {
      type: DataTypes.INTEGER, // in minutes
      defaultValue: 0,
    },
    cancellation_rate: {
      type: DataTypes.DECIMAL(5, 2), // percentage
      defaultValue: 0.0,
      validate: {
        min: 0,
        max: 100,
      },
    },
    documents_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    id_card_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    student_card_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    rejection_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    approved_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_active_at: {
      type: DataTypes.DATE,
      allowNull: true,
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
    indexes: [
      {
        fields: ['user_id']
      },
      {
        fields: ['is_available']
      },
      {
        fields: ['is_approved']
      },
      {
        fields: ['rating']
      }
    ]
  }
);

export default Runner;