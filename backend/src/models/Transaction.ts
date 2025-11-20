import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import Errand from './Errand';

interface TransactionAttributes {
  id: number;
  errand_id: number;
  customer_id: number;
  runner_id: number;
  amount: number;
  base_amount: number; // Added: original amount without fees
  platform_fee: number;
  runner_earnings: number;
  payment_status: 'pending' | 'completed' | 'failed' | 'refunded';
  payment_method: string;
  transaction_code?: string;
  created_at: Date;
}

interface TransactionCreationAttributes extends Optional<TransactionAttributes, 'id' | 'payment_status' | 'created_at' | 'transaction_code'> {}

class Transaction extends Model<TransactionAttributes, TransactionCreationAttributes> implements TransactionAttributes {
  public id!: number;
  public errand_id!: number;
  public customer_id!: number;
  public runner_id!: number;
  public amount!: number;
  public base_amount!: number;
  public platform_fee!: number;
  public runner_earnings!: number;
  public payment_status!: 'pending' | 'completed' | 'failed' | 'refunded';
  public payment_method!: string;
  public transaction_code?: string;
  public created_at!: Date;
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
      comment: 'Final amount paid by customer (including all fees)',
    },
    base_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: 'Original errand price without platform fees',
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
      type: DataTypes.ENUM('pending', 'completed', 'failed', 'refunded'),
      defaultValue: 'pending',
    },
    payment_method: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    transaction_code: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'transactions',
    timestamps: true,
    underscored: true,
  }
);

export default Transaction;