// google-calendar.e2e-spec 전용: AppModule(ConfigModule.forRoot)이 읽기 전에 가짜 OAuth 클라이언트 값을 넣는다.
process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/api/google/callback';
