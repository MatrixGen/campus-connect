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
  avatar_url?: string;
  is_active: boolean;
  date_of_birth?: Date;
  gender?: 'male' | 'female' | 'other';
  campus_location?: string;
  created_at: Date;
  updated_at: Date;
}

interface UserCreationAttributes extends Optional<UserAttributes, 'id' | 'verification_status' | 'is_active' | 'created_at' | 'updated_at'> {}

class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: number;
  public phone_number!: string;
  public email?: string;
  public full_name!: string;
  public user_type!: 'customer' | 'runner' | 'both';
  public student_id?: string;
  public verification_status!: 'pending' | 'verified' | 'rejected';
  public avatar_url?: string;
  public is_active!: boolean;
  public date_of_birth?: Date;
  public gender?: 'male' | 'female' | 'other';
  public campus_location?: string;
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
      validate: {
        isEmail: true,
      },
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
      unique: true,
    },
    verification_status: {
      type: DataTypes.ENUM('pending', 'verified', 'rejected'),
      defaultValue: 'pending',
    },
    avatar_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    date_of_birth: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    gender: {
      type: DataTypes.ENUM('male', 'female', 'other'),
      allowNull: true,
    },
    campus_location: {
      type: DataTypes.STRING(100),
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
    tableName: 'users',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['phone_number']
      },
      {
        fields: ['email']
      },
      {
        fields: ['user_type']
      },
      {
        fields: ['verification_status']
      }
    ]
  }
);

export default User;