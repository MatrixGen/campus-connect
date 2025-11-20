import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import User from './User';
import Errand from './Errand';

interface TransactionAttributes {
  id: number;
  errand_id: number;
  customer_id: number;
  runner_id: number;
  amount: number;
  base_amount: number;
  platform_fee: number;
  runner_earnings: number;
  payment_status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  payment_method: 'wallet' | 'mobile_money' | 'card';
  transaction_reference?: string;
  payment_gateway_response?: any;
  completed_at?: Date;
  created_at: Date;
  updated_at: Date;
}

interface TransactionCreationAttributes extends Optional<TransactionAttributes, 'id' | 'payment_status' | 'created_at' | 'updated_at'> {}

class Transaction extends Model<TransactionAttributes, TransactionCreationAttributes> implements TransactionAttributes {
  public id!: number;
  public errand_id!: number;
  public customer_id!: number;
  public runner_id!: number;
  public amount!: number;
  public base_amount!: number;
  public platform_fee!: number;
  public runner_earnings!: number;
  public payment_status!: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  public payment_method!: 'wallet' | 'mobile_money' | 'card';
  public transaction_reference?: string;
  public payment_gateway_response?: any;
  public completed_at?: Date;
  public created_at!: Date;
  public updated_at!: Date;
}

Transaction.init(
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
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    base_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    platform_fee: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    runner_earnings: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    payment_status: {
      type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed', 'refunded'),
      defaultValue: 'pending',
    },
    payment_method: {
      type: DataTypes.ENUM('wallet', 'mobile_money', 'card'),
      allowNull: false,
    },
    transaction_reference: {
      type: DataTypes.STRING(100),
      allowNull: true,
      unique: true,
    },
    payment_gateway_response: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    completed_at: {
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
    tableName: 'transactions',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['errand_id']
      },
      {
        fields: ['customer_id']
      },
      {
        fields: ['runner_id']
      },
      {
        fields: ['payment_status']
      },
      {
        fields: ['transaction_reference']
      },
      {
        fields: ['created_at']
      }
    ]
  }
);

export default Transaction;