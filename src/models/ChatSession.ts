import mongoose, { Schema, Document } from 'mongoose';

interface IMessage {
    senderId: string;
    text: string;
    timestamp: Date;
}

export interface IChatSession extends Document {
    user1Id: string;
    user2Id: string;
    user1Name: string;
    user2Name: string;
    messages: IMessage[];
    startedAt: Date;
    endedAt?: Date;
    reported: boolean;
    reportedBy?: string;
    reportReason?: string;
}

const MessageSchema = new Schema<IMessage>({
    senderId: {
        type: String,
        required: true
    },
    text: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
}, { _id: false });

const ChatSessionSchema = new Schema<IChatSession>({
    user1Id: {
        type: String,
        required: true
    },
    user2Id: {
        type: String,
        required: true
    },
    user1Name: {
        type: String,
        required: true
    },
    user2Name: {
        type: String,
        required: true
    },
    messages: [MessageSchema],
    startedAt: {
        type: Date,
        default: Date.now
    },
    endedAt: {
        type: Date
    },
    reported: {
        type: Boolean,
        default: false
    },
    reportedBy: {
        type: String
    },
    reportReason: {
        type: String
    }
});

// Index for finding user's chat history
ChatSessionSchema.index({ user1Id: 1, user2Id: 1 });
ChatSessionSchema.index({ startedAt: -1 });

export default mongoose.models.ChatSession || mongoose.model<IChatSession>('ChatSession', ChatSessionSchema);
