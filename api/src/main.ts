import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // "allowedHeaders" liet ke ro vi mac dinh enableCors() KHONG tu dong cho
  // qua cac header tuy chinh (custom header) - "X-User-Name" duoc frontend
  // gan vao moi request de ghi log nguoi thuc thi (xem RequestLogInterceptor
  // + officeToolClient.js ben ams), thieu dong nay trinh duyet se chan luon
  // request bang preflight OPTIONS that bai truoc khi header toi duoc server.
  app.enableCors({
    allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Name'],
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('OfficeTool API')
    .setDescription('Bộ công cụ xử lý PDF/Office cho dân văn phòng')
    .setVersion('0.1')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
