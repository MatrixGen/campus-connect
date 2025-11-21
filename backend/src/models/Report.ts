import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import User from './User';
import Errand from './Errand';

interface ReportAttributes {
  id: number;
  reporter_id: number;
  reported_user_id: number;
  errand_id?: number;
  report_type: 'fraud' | 'harassment' | 'poor_service' | 'fake_profile' | 'payment_issue' | 'other';
  title: string;
  description: string;
  evidence_urls?: string[];
  status: 'pending' | 'under_review' | 'resolved' | 'dismissed';
  admin_notes?: string;
  resolved_at?: Date;
  created_at: Date;
  updated_at: Date;
}

interface ReportCreationAttributes extends Optional<ReportAttributes, 'id' | 'status' | 'created_at' | 'updated_at'> {}

class Report extends Model<ReportAttributes, ReportCreationAttributes> implements ReportAttributes {
  public id!: number;
  public reporter_id!: number;
  public reported_user_id!: number;
  public errand_id?: number;
  public report_type!: 'fraud' | 'harassment' | 'poor_service' | 'fake_profile' | 'payment_issue' | 'other';
  public title!: string;
  public description!: string;
  public evidence_urls!: string[];
  public status!: 'pending' | 'under_review' | 'resolved' | 'dismissed';
  public admin_notes?: string;
  public resolved_at?: Date;
  public created_at!: Date;
  public updated_at!: Date;
}

Report.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    reporter_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    reported_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    errand_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'errands',
        key: 'id',
      },
    },
    report_type: {
      type: DataTypes.ENUM('fraud', 'harassment', 'poor_service', 'fake_profile', 'payment_issue', 'other'),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    evidence_urls: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
    },
    status: {
      type: DataTypes.ENUM('pending', 'under_review', 'resolved', 'dismissed'),
      defaultValue: 'pending',
    },
    admin_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    resolved_at: {
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
    tableName: 'reports',
    timestamps: true,
    underscored: true,
  }
);

export default Report;