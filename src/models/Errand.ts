import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import User from './User';

interface ErrandAttributes {
  id: number;
  customer_id: number;
  runner_id?: number;
  title: string;
  description?: string;
  category: string;
  location_from: string;
  location_to: string;
  base_price: number;
  final_price: number;
  urgency: string;
  distance_km?: number;
  estimated_duration_min?: number;
  status: string;
  cancellation_reason?: string;
  cancelled_by?: number;
  pricing_breakdown?: any;
  accepted_at?: Date;
  started_at?: Date;
  completed_at?: Date;
  cancelled_at?: Date;
  created_at: Date;
  updated_at: Date;
}

interface ErrandCreationAttributes extends Optional<ErrandAttributes, 'id' | 'status' | 'created_at' | 'updated_at'> {}

class Errand extends Model<ErrandAttributes, ErrandCreationAttributes> implements ErrandAttributes {
  public id!: number;
  public customer_id!: number;
  public runner_id?: number;
  public title!: string;
  public description?: string;
  public category!: string;
  public location_from!: string;
  public location_to!: string;
  public base_price!: number;
  public final_price!: number;
  public urgency!: string;
  public distance_km?: number;
  public estimated_duration_min?: number;
  public status!: string;
  public cancellation_reason?: string;
  public cancelled_by?: number;
  public pricing_breakdown?: any;
  public accepted_at?: Date;
  public started_at?: Date;
  public completed_at?: Date;
  public cancelled_at?: Date;
  public created_at!: Date;
  public updated_at!: Date;
}

Errand.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    customer_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    runner_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    category: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    location_from: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    location_to: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    base_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    final_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    urgency: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    distance_km: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: true,
    },
    estimated_duration_min: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'pending',
    },
    cancellation_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    cancelled_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    pricing_breakdown: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    accepted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    started_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    cancelled_at: {
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
    tableName: 'errands',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['customer_id']
      },
      {
        fields: ['runner_id']
      },
      {
        fields: ['status']
      },
      {
        fields: ['category']
      },
      {
        fields: ['urgency']
      },
      {
        fields: ['created_at']
      }
    ]
  }
);

export default Errand;