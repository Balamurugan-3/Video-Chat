import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import ChatSession from '@/models/ChatSession';

export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.ADMIN_PASSWORD}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await dbConnect();

        // Get stats
        const totalUsers = await User.countDocuments();
        const activeUsers = await User.countDocuments({
            lastLogin: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const chatsToday = await ChatSession.countDocuments({
            startedAt: { $gte: today }
        });

        const totalChats = await ChatSession.countDocuments();

        // Get signups over last 7 days
        const signupData = await User.aggregate([
            {
                $match: {
                    createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Get chats over last 7 days
        const chatData = await ChatSession.aggregate([
            {
                $match: {
                    startedAt: { $gte: new Date(Date.now() - 7 * 60 * 60 * 1000) }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$startedAt' } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        return NextResponse.json({
            stats: {
                totalUsers,
                activeUsers,
                chatsToday,
                totalChats
            },
            charts: {
                signupData,
                chatData
            }
        });
    } catch (error) {
        console.error('Error fetching admin stats:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
