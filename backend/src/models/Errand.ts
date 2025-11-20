import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface ErrandAttributes {
  id: number;
  customer_id: number;
  runner_id?: number;
  title: string;
  description?: string;
  category: 'delivery' | 'printing' | 'shopping' | 'academic' | 'queue_standing';
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  location_from: string;
  location_to: string;
  base_price: number; // Added: original customer budget without fees
  final_price: number; // Added: total price including all fees
  urgency: 'standard' | 'urgent';
  distance_km: number; // Added: store distance
  estimated_duration_min?: number;
  created_at: Date;
  accepted_at?: Date;
  started_at?: Date; // Added: when runner starts the errand
  completed_at?: Date;
}

interface ErrandCreationAttributes extends Optional<ErrandAttributes, 'id' | 'status' | 'urgency' | 'created_at'> {}

class Errand extends Model<ErrandAttributes, ErrandCreationAttributes> implements ErrandAttributes {
  public id!: number;
  public customer_id!: number;
  public runner_id?: number;
  public title!: string;
  public description?: string;
  public category!: 'delivery' | 'printing' | 'shopping' | 'academic' | 'queue_standing';
  public status!: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  public location_from!: string;
  public location_to!: string;
  public base_price!: number;
  public final_price!: number;
  public urgency!: 'standard' | 'urgent';
  public distance_km!: number;
  public estimated_duration_min?: number;
  public created_at!: Date;
  public accepted_at?: Date;
  public started_at?: Date;
  public completed_at?: Date;
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
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    category: {
      type: DataTypes.ENUM('delivery', 'printing', 'shopping', 'academic', 'queue_standing'),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('pending', 'accepted', 'in_progress', 'completed', 'cancelled'),
      defaultValue: 'pending',
    },
    location_from: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    location_to: {
      type: DataTypes.STRING(255),
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
      type: DataTypes.ENUM('standard', 'urgent'),
      defaultValue: 'standard',
    },
    distance_km: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: false,
      defaultValue: 0,
    },
    estimated_duration_min: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
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
  },
  {
    sequelize,
    tableName: 'errands',
    timestamps: true,
    underscored: true,
  }
);

export default Errand;