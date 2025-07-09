require('dotenv').config()
const express = require('express')
const http = require('http')
const cors = require('cors')
const { PrismaClient } = require('@prisma/client')
const { Server } = require('socket.io')

const app = express()
const server = http.createServer(app)
const io = new Server(server, {
    cors: {
        origin: '*', // allow all origins (change in production)
    },
})

const prisma = new PrismaClient()

app.use(cors())
app.use(express.json())

// 📦 REST API to fetch messages
app.get('/messages', async (req, res) => {
    try {
        const messages = await prisma.message.findMany({
            include: { user: true },
            orderBy: { timestamp: 'desc' },
            take: 50,
        })
        res.json(messages)
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch messages' })
    }
})

// 🔌 Socket.io for real-time chat
io.on('connection', (socket) => {
    console.log('✅ User connected:', socket.id)

    socket.on('join', async ({ userId, userName }) => {
        console.log(`${userName} joined`)

        await prisma.log.create({
            data: {
                action: 'join',
                userId,
                details: `${userName} joined the chat.`,
            },
        })
    })

    socket.on('send_message', async ({ content, userId, userName }) => {
        try {
            const message = await prisma.message.create({
                data: {
                    content,
                    userId,
                },
            })

            io.emit('receive_message', {
                id: message.id,
                content: message.content,
                timestamp: message.timestamp,
                user: { name: userName },
            })

            await prisma.log.create({
                data: {
                    action: 'send_message',
                    userId,
                    details: `${userName} sent a message.`,
                },
            })
        } catch (err) {
            console.error('Error sending message:', err)
        }
    })

    socket.on('disconnect', () => {
        console.log('❌ User disconnected:', socket.id)
    })
})

const PORT = process.env.PORT || 5000
server.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`))
