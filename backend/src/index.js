require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const fetch = require('node-fetch');

const { initializeDatabase, pool } = require('./database');
console.log('Database module loaded');

const app = express();
console.log('Express app created');

app.use(cors({ 
  origin: '*', 
  credentials: true 
}));

app.use((req, res, next) => {
  console.log('REQUEST:', req.method, req.url);
  next();
});

app.use(express.json());

// const limiter = rateLimit({ windowMs: 15*60*1000, max: 100 });
// app.use(limiter);

console.log('Loading routes...');
try {
  app.use('/api/auth', require('./routes/auth'));
  console.log('✅ Auth routes loaded');
} catch(e) { console.error('❌ Auth routes error:', e.message); }
try {
  app.use('/api/user', require('./routes/user'));
  console.log('✅ User routes loaded');
} catch(e) { console.error('❌ User routes error:', e.message); }
try {
  app.use('/api/wallet', require('./routes/wallet'));
  console.log('✅ Wallet routes loaded');
} catch(e) { console.error('❌ Wallet routes error:', e.message); }
try {
  app.use('/api/deposit', require('./routes/deposit'));
  console.log('✅ Deposit routes loaded');
} catch(e) { console.error('❌ Deposit routes error:', e.message); }
try {
  const withdrawalRouter = require('./routes/withdrawal');
  app.use('/api/withdrawal', withdrawalRouter);
  app.use('/api/withdraw', withdrawalRouter);
  console.log('✅ Withdraw routes loaded');
} catch(e) { console.error('❌ Withdraw routes error:', e.message); }
try {
  app.use('/api/referral', require('./routes/referral'));
  console.log('✅ Referral routes loaded');
} catch(e) { console.error('❌ Referral routes error:', e.message); }
try {
  app.use('/api/admin', require('./routes/admin'));
  console.log('✅ Admin routes loaded');
} catch(e) { console.error('❌ Admin routes error:', e.message); }
try {
  app.use('/api/public', require('./routes/public'));
  console.log('✅ Public routes loaded');
} catch(e) { console.error('❌ Public routes error:', e.message); }
try {
  app.use('/api/jtoken-purchase', require('./routes/jtokenPurchase'));
  console.log('✅ J Token purchase routes loaded');
} catch(e) { console.error('❌ J Token purchase routes error:', e.message); }
console.log('Routes loaded');

// Telegram Bot Integration
let bot = null;
if (process.env.TELEGRAM_BOT_TOKEN) {
  const TelegramBot = require('node-telegram-bot-api');
  
  bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
  
  console.log('🤖 Telegram Bot initializing...');
  
  const isProduction = !!process.env.RENDER_EXTERNAL_URL;
  
  if (isProduction) {
    const webhookUrl = `${process.env.RENDER_EXTERNAL_URL}/api/telegram-webhook`;
    console.log(`🤖 Telegram Bot setting webhook to: ${webhookUrl}`);
    
    app.post('/api/telegram-webhook', (req, res) => {
      try {
        bot.processUpdate(req.body);
      } catch (err) {
        console.error('⚠️ Webhook processUpdate error:', err.message);
      }
      res.sendStatus(200);
    });

    (async () => {
      try {
        await bot.setWebHook(webhookUrl);
        console.log('✅ Telegram Webhook set successfully!');
      } catch (e) {
        console.error('❌ Failed to set Telegram Webhook:', e.message);
      }
    })();
  } else {
    // Local development: use polling
    (async () => {
      try {
        await bot.deleteWebHook();
        console.log('✅ Webhook cleared (polling mode)');
      } catch (e) {}
      
      try {
        await bot.close();
        console.log('✅ Existing connection closed');
      } catch (e) {}
      
      await new Promise(r => setTimeout(r, 1000));
      
      bot.startPolling({
        interval: 1000,
        timeout: 0,
        allowedUpdates: ['message']
      });
      console.log('✅ Telegram Bot polling started!');
    })();
  }
  
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    if (!text || text.startsWith('/')) {
      bot.sendMessage(chatId, 
        '👋 Welcome to ZCrypto Bot!\n\n' +
        '📧 Send your registered email to get verification key!'
      );
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (emailRegex.test(text)) {
      try {
        bot.sendMessage(chatId, '🔄 Generating your verification key...');
        
        const telegramName = msg.from.first_name || '';
        const telegramUsername = msg.from.username || '';
        const telegramChatId = msg.from.id || '';
        
        const baseUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 9001}`;
        const res = await fetch(`${baseUrl}/api/public/telegram/generate-key`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            email: text.toLowerCase(),
            telegramName,
            telegramUsername,
            telegramChatId
          })
        });
        
        const data = await res.json();
        
        if (data.error) {
          bot.sendMessage(chatId, `❌ ${data.error}`);
        } else if (data.key) {
          bot.sendMessage(chatId, 
            `✅ Key Generated!\n\n` +
            `🔑 Your Key:\n<code>${data.key}</code>\n\n` +
            `⏰ Valid for 15 minutes\n\n` +
            `📋 Paste it on the website!`,
            { parse_mode: 'HTML' }
          );
        }
      } catch (e) {
        console.error('Bot error:', e);
        bot.sendMessage(chatId, '❌ Error. Please try again.');
      }
    } else {
      bot.sendMessage(chatId, '📧 Please enter a valid email address.');
    }
  });
}

app.get('/api/health', (req, res) => res.json({ status: 'ok', message: 'Premium Earning API' }));

// Silent ping endpoint (no logging)
app.get('/ping', (req, res) => res.sendStatus(200));

app.get('/api/test', (req, res) => res.json({ message: 'Server is working' }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

async function startServer() {
  const dbInitialized = await initializeDatabase();
  if (!dbInitialized) {
    console.error('Database init failed');
    process.exit(1);
  }

  const PORT = process.env.PORT || 7000;
  app.listen(PORT, () => console.log(`Server on port ${PORT}`));
  
  // Self-ping to prevent Render from sleeping
  const BASE_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  const PING_INTERVAL = 8 * 60 * 1000; // 8 minutes (before 10 min sleep)
  
  console.log(`🔄 Self-ping enabled (${PING_INTERVAL/60000} min interval)`);
  
  setInterval(async () => {
    try {
      await fetch(`${BASE_URL}/ping`);
      console.log(`✅ Server ping at ${new Date().toLocaleTimeString()}`);
    } catch (err) {
      console.log(`⚠️ Self-ping failed: ${err.message}`);
    }
  }, PING_INTERVAL);
  
  // Ping immediately on startup
  setTimeout(async () => {
    try {
      await fetch(`${BASE_URL}/api/health`);
      console.log('✅ Initial self-ping done');
    } catch (err) {}
  }, 5000);
}

startServer();
