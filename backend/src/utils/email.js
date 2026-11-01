const https = require('https');

const sendOtp = async (email, otp) => {
  const BREVO_API_KEY = process.env.BREVO_API_KEY;

  if (!BREVO_API_KEY) {
    throw new Error('BREVO_API_KEY missing in Render environment');
  }

  const senderEmail = process.env.EMAIL_FROM || 'devxzenox@gmail.com';

  const data = JSON.stringify({
    sender: {
      name: 'Jex Pay',
      email: senderEmail
    },
    to: [{ email }],
    subject: 'Your OTP Code - Jex Pay',
    htmlContent: `
      <div style="font-family:Arial,sans-serif;padding:20px">
        <h2 style="color:#D4AF37">Jex Pay</h2>
        <p>Your email verification OTP is:</p>
        <h1 style="color:#D4AF37">${otp}</h1>
        <p>This OTP expires in 10 minutes.</p>
      </div>
    `
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.brevo.com',
      port: 443,
      path: '/v3/smtp/email',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': BREVO_API_KEY,
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let body = '';

      res.on('data', chunk => body += chunk);

      res.on('end', () => {
        console.log('BREVO STATUS:', res.statusCode);

        if (res.statusCode === 201) {
          console.log('OTP EMAIL SENT SUCCESSFULLY');
          resolve();
        } else {
          console.error('BREVO ERROR:', body);
          reject(new Error(body));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
};

module.exports = { sendOtp };
