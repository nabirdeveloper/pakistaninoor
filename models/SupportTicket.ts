import mongoose, { Schema, Document, Model } from 'mongoose';

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketStatus = 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed';
export type TicketCategory = 'order' | 'payment' | 'shipping' | 'product' | 'refund' | 'technical' | 'other';

export interface ITicketMessage {
  _id?: string;
  sender: mongoose.Types.ObjectId;
  senderType: 'user' | 'admin';
  message: string;
  attachments?: string[];
  isInternal: boolean; // Internal notes not visible to customer
  createdAt: Date;
}

export interface ISupportTicket extends Document {
  ticketNumber: string;
  user: mongoose.Types.ObjectId;
  category: TicketCategory;
  subject: string;
  priority: TicketPriority;
  status: TicketStatus;
  order?: mongoose.Types.ObjectId;
  product?: mongoose.Types.ObjectId;
  messages: ITicketMessage[];
  assignedTo?: mongoose.Types.ObjectId;
  resolvedBy?: mongoose.Types.ObjectId;
  resolvedAt?: Date;
  closedAt?: Date;
  satisfaction?: number; // 1-5 rating
  feedback?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<ITicketMessage>({
  sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  senderType: { type: String, enum: ['user', 'admin'], required: true },
  message: { type: String, required: true },
  attachments: [String],
  isInternal: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

const SupportTicketSchema = new Schema<ISupportTicket>(
  {
    ticketNumber: {
      type: String,
      required: true,
      unique: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    category: {
      type: String,
      enum: ['order', 'payment', 'shipping', 'product', 'refund', 'technical', 'other'],
      required: true,
    },
    subject: {
      type: String,
      required: true,
      maxlength: 200,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'waiting_customer', 'resolved', 'closed'],
      default: 'open',
    },
    order: { type: Schema.Types.ObjectId, ref: 'Order' },
    product: { type: Schema.Types.ObjectId, ref: 'Product' },
    messages: [MessageSchema],
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: Date,
    closedAt: Date,
    satisfaction: { type: Number, min: 1, max: 5 },
    feedback: String,
    tags: [String],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
// Note: ticketNumber is unique: true on the schema, which already creates its index
SupportTicketSchema.index({ user: 1, status: 1 });
SupportTicketSchema.index({ status: 1, priority: -1, createdAt: -1 });
SupportTicketSchema.index({ assignedTo: 1, status: 1 });
SupportTicketSchema.index({ category: 1, status: 1 });

// Pre-save: Generate ticket number
SupportTicketSchema.pre('save', async function () {
  if (!this.ticketNumber) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');

    const count = await mongoose.model('SupportTicket').countDocuments({
      createdAt: {
        $gte: new Date(date.getFullYear(), date.getMonth(), 1),
        $lt: new Date(date.getFullYear(), date.getMonth() + 1, 1),
      },
    });

    const sequence = (count + 1).toString().padStart(4, '0');
    this.ticketNumber = `TKT${year}${month}${sequence}`;
  }
});

// Virtual: Is open
SupportTicketSchema.virtual('isOpen').get(function () {
  return ['open', 'in_progress', 'waiting_customer'].includes(this.status);
});

// Virtual: Response time (first admin response)
SupportTicketSchema.virtual('firstResponseTime').get(function () {
  const adminMessage = this.messages.find((m) => m.senderType === 'admin' && !m.isInternal);
  if (!adminMessage) return null;

  const diff = adminMessage.createdAt.getTime() - this.createdAt.getTime();
  return Math.round(diff / 1000 / 60); // in minutes
});

// Virtual: Resolution time
SupportTicketSchema.virtual('resolutionTime').get(function () {
  if (!this.resolvedAt) return null;

  const diff = this.resolvedAt.getTime() - this.createdAt.getTime();
  return Math.round(diff / 1000 / 60); // in minutes
});

// Virtual: Customer messages (excluding internal notes)
SupportTicketSchema.virtual('publicMessages').get(function () {
  return this.messages.filter((m) => !m.isInternal);
});

const SupportTicket: Model<ISupportTicket> = mongoose.models.SupportTicket || mongoose.model<ISupportTicket>('SupportTicket', SupportTicketSchema);

export default SupportTicket;
