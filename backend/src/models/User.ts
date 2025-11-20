import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface UserAttributes {
  id: number;
  phone_number: string;
  email?: string;
  full_name: string;
  user_type: 'customer' | 'runner' | 'both';
  student_id?: string;
  verification_status: 'pending' | 'verified' | 'rejected';
  created_at: Date;
  updated_at: Date;
}

interface UserCreationAttributes extends Optional<UserAttributes, 'id' | 'verification_status' | 'created_at' | 'updated_at'> {}

class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: number;
  public phone_number!: string;
  public email?: string;
  public full_name!: string;
  public user_type!: 'customer' | 'runner' | 'both';
  public student_id?: string;
  public verification_status!: 'pending' | 'verified' | 'rejected';
  public created_at!: Date;
  public updated_at!: Date;
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    phone_number: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    full_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    user_type: {
      type: DataTypes.ENUM('customer', 'runner', 'both'),
      allowNull: false,
    },
    student_id: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    verification_status: {
      type: DataTypes.ENUM('pending', 'verified', 'rejected'),
      defaultValue: 'pending',
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
    tableName: 'users',
    timestamps: true,
    underscored: true,
  }
);

export default User;