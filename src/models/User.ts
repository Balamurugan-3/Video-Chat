import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
    googleId: string;
    email: string;
    name: string;
    picture?: string;
    createdAt: Date;
    lastLogin: Date;
    totalChats: number;
    banned: boolean;
}

const UserSchema = new Schema<IUser>({
    googleId: {
        type: String,
        required: true,
        unique: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    picture: {
        type: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastLogin: {
        type: Date,
        default: Date.now
    },
    totalChats: {
        type: Number,
        default: 0
    },
    banned: {
        type: Boolean,
        default: false
    }
});

export default mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
