# Soluções de Deploy e Análise de Custos - Commander 150

## 📋 Sumário Executivo

Este documento apresenta uma análise detalhada das opções de deploy e custos para o sistema Commander 150, uma aplicação web para gestão de torneios de Magic: The Gathering no formato 2v2.

**Stack Tecnológica:**
- **Backend:** Django 5.2.6 + Django REST Framework + PostgreSQL
- **Frontend:** React 19 + TypeScript + Vite
- **Autenticação:** Session-based (Django Sessions)
- **APIs:** RESTful com documentação Swagger (drf-yasg)

---

## 🏗️ Arquitetura da Aplicação

### Backend (Django API)
```
Tecnologias principais:
- Django 5.2.6
- Django REST Framework 3.16.1
- PostgreSQL (psycopg2-binary)
- Django CORS Headers
- drf-yasg (Swagger/OpenAPI)
- Session-based authentication
```

**Apps Django:**
- `usuarios` - Gerenciamento de usuários e autenticação
- `torneios` - Lógica de torneios, inscrições, rodadas e resultados

**Requisitos de Infraestrutura:**
- Python 3.9+
- PostgreSQL 13+
- SMTP para envio de emails (Gmail configurado)
- Sessões persistidas em banco de dados

### Frontend (React + Vite)
```
Tecnologias principais:
- React 19.1.1
- TypeScript 5.8.3
- Vite 7.1.2
- React Router DOM 7.8.2
- Axios para comunicação com API
- SweetAlert2 para alertas
```

**Características:**
- SPA (Single Page Application)
- Build otimizado com Vite
- Assets estáticos (JS, CSS, imagens)

---

## 🚀 Opções de Deploy

### Opção 1: Deploy Tradicional em VPS (Digital Ocean / Vultr / Linode)

#### Configuração Recomendada

**Servidor Único (Full Stack)**
```
Especificações:
- 2 vCPUs
- 4 GB RAM
- 80 GB SSD
- 4 TB Transfer

Stack:
- Ubuntu 22.04 LTS
- Nginx (reverse proxy + servir frontend)
- Gunicorn (WSGI server para Django)
- PostgreSQL (banco de dados)
- Supervisor (gerenciamento de processos)
- Certbot (SSL com Let's Encrypt)
```

#### Estrutura de Deploy
```
/var/www/
├── backend/           # Django API
│   ├── venv/         # Ambiente virtual Python
│   ├── core/         # Settings Django
│   ├── usuarios/
│   ├── torneios/
│   ├── staticfiles/  # Arquivos estáticos do Django
│   └── manage.py
└── frontend/         # Build do React
    └── dist/         # Arquivos estáticos buildados
```

#### Configuração Nginx
```nginx
# API Backend
upstream django_backend {
    server unix:/var/run/gunicorn.sock fail_timeout=0;
}

server {
    listen 80;
    server_name api.commander150.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.commander150.com;

    ssl_certificate /etc/letsencrypt/live/api.commander150.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.commander150.com/privkey.pem;

    location /api/v1/ {
        proxy_pass http://django_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /static/ {
        alias /var/www/backend/staticfiles/;
        expires 30d;
    }
}

# Frontend
server {
    listen 80;
    server_name commander150.com www.commander150.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name commander150.com www.commander150.com;

    ssl_certificate /etc/letsencrypt/live/commander150.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/commander150.com/privkey.pem;

    root /var/www/frontend/dist;
    index index.html;

    # Configuração para SPA (React Router)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache de assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

#### Configuração Gunicorn
```bash
# /etc/supervisor/conf.d/gunicorn.conf
[program:gunicorn]
directory=/var/www/backend
command=/var/www/backend/venv/bin/gunicorn --workers 3 --bind unix:/var/run/gunicorn.sock core.wsgi:application
user=www-data
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/var/log/gunicorn.log
```

#### Script de Deploy
```bash
#!/bin/bash
# deploy.sh

echo "🚀 Iniciando deploy..."

# Backend
cd /var/www/backend
git pull origin main
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
sudo supervisorctl restart gunicorn

# Frontend
cd /var/www/frontend
git pull origin main
npm install
npm run build

echo "✅ Deploy concluído!"
```

#### Custos Mensais (Digital Ocean)

| Componente | Especificação | Custo (USD) |
|------------|---------------|-------------|
| **Droplet** | 2 vCPUs, 4GB RAM, 80GB SSD | $24.00 |
| **Domínio** | .com (anual ÷ 12) | ~$1.00 |
| **Backup Automático** | 20% do droplet (opcional) | $4.80 |
| **Monitoramento** | Digital Ocean Monitoring (free) | $0.00 |
| **Total Básico** | | **$25.00** |
| **Total com Backup** | | **$29.80** |

**Conversão para BRL (cotação R$ 5,00):**
- Básico: **R$ 125,00/mês**
- Com backup: **R$ 149,00/mês**

#### Provedores Alternativos

**Vultr**
- High Frequency: 2 vCPUs, 4GB RAM - $24/mês
- Snapshots: $1/GB/mês

**Linode (Akamai)**
- Linode 4GB: 2 vCPUs, 4GB RAM - $24/mês
- Backups: $5/mês

**Contabo**
- VPS M: 4 vCPUs, 8GB RAM, 200GB SSD - €8.99/mês (~$10)
- Melhor custo-benefício, porém suporte limitado

---

### Opção 2: Platform as a Service (PaaS)

#### 2.1 Render.com (Recomendado para MVP)

**Backend (Django)**
```yaml
# render.yaml
services:
  - type: web
    name: commander150-api
    env: python
    buildCommand: "pip install -r requirements.txt"
    startCommand: "gunicorn core.wsgi:application"
    plan: starter  # $7/mês
    envVars:
      - key: PYTHON_VERSION
        value: 3.11.0
      - key: DEBUG
        value: false
      - key: SECRET_KEY
        generateValue: true
      - key: DATABASE_URL
        fromDatabase:
          name: commander150-db
          property: connectionString

databases:
  - name: commander150-db
    plan: starter  # $7/mês
    databaseName: commander150
    user: commander150
```

**Frontend (React)**
- Static Site
- Deploy automático via Git
- CDN global incluído
- **Gratuito**

**Custos Render:**
| Componente | Plano | Custo (USD) |
|------------|-------|-------------|
| Web Service (Backend) | Starter | $7.00 |
| PostgreSQL | Starter (1GB) | $7.00 |
| Static Site (Frontend) | Free | $0.00 |
| **Total** | | **$14.00** |

**Em BRL:** ~**R$ 70,00/mês**

**Vantagens:**
- Deploy automático via Git
- SSL gratuito
- Logs integrados
- Fácil escalabilidade
- Zero configuração de servidor

**Limitações:**
- Instâncias dormem após 15min de inatividade (plano free)
- Plano Starter tem cold start mais rápido
- Menos controle sobre infraestrutura

#### 2.2 Railway.app

**Configuração:**
```
Backend (Django): $5/mês (Starter)
PostgreSQL: $5/mês (Shared)
Frontend (Static): Gratuito
Total: $10/mês (~R$ 50,00)
```

**Características:**
- $5 de crédito gratuito/mês
- Deploy via Git
- Variáveis de ambiente por branch
- Logs em tempo real

#### 2.3 Fly.io

**Máquinas:**
```
Backend: shared-cpu-1x, 256MB RAM
Database: Postgres (1GB storage)
Frontend: CDN global

Estimativa: $0-5/mês (tem free tier generoso)
```

**Destaque:**
- Excelente free tier
- Deploy global (edge computing)
- Suporte a WebSockets

---

### Opção 3: Serverless / Cloud Native

#### 3.1 AWS (Amazon Web Services)

**Arquitetura Proposta:**

```
Frontend:
- S3 (armazenamento estático)
- CloudFront (CDN)

Backend:
- Elastic Beanstalk (Django)
  OU
- ECS Fargate (containers)
- RDS PostgreSQL (t3.micro)

Custo Estimado:
- S3 + CloudFront: ~$1-3/mês
- Elastic Beanstalk (t3.small): ~$13/mês
- RDS t3.micro: ~$13/mês
- Total: $27-29/mês (~R$ 135-145)
```

**Vantagens:**
- Alta disponibilidade
- Escalabilidade automática
- Infraestrutura mundial
- Free tier (12 meses)

**Desvantagens:**
- Complexidade de configuração
- Curva de aprendizado
- Custos podem escalar rapidamente

#### 3.2 Google Cloud Platform (GCP)

```
Frontend:
- Cloud Storage + Cloud CDN
- $1-2/mês

Backend:
- Cloud Run (containers, serverless)
- $7-15/mês (depende do tráfego)

Database:
- Cloud SQL (PostgreSQL, db-f1-micro)
- $7/mês

Total: ~$15-24/mês (~R$ 75-120)
```

**Destaque:**
- Cloud Run é pay-per-use
- Bom free tier ($300 crédito inicial)
- Integração com Firebase

#### 3.3 Azure

```
Frontend:
- Azure Static Web Apps (gratuito)

Backend:
- App Service (B1): $13/mês
- Azure Database for PostgreSQL (B1): $23/mês

Total: ~$36/mês (~R$ 180)
```

---

### Opção 4: Hospedagem Compartilhada / Especializada Python

#### PythonAnywhere

**Plano Web App:**
- Hacker: $5/mês (100k hits/dia)
- Web App Django + PostgreSQL MySQL
- SSL incluído
- **Limitação:** Não suporta WebSocket

**Para Commander 150:**
```
Custo: $5/mês (~R$ 25)
Adequação: Boa para MVP/protótipo
Limitações: Performance limitada
```

---

## 📊 Comparativo Completo de Custos

| Solução | Custo Mensal (USD) | Custo Mensal (BRL) | Complexidade | Escalabilidade |
|---------|-------------------|-------------------|--------------|----------------|
| **VPS (Digital Ocean)** | $24-30 | R$ 120-150 | Alta | Média |
| **VPS (Contabo)** | $10 | R$ 50 | Alta | Média |
| **Render.com** | $14 | R$ 70 | Baixa | Alta |
| **Railway.app** | $10 | R$ 50 | Baixa | Alta |
| **Fly.io** | $0-5 | R$ 0-25 | Média | Alta |
| **AWS (básico)** | $27-29 | R$ 135-145 | Muito Alta | Muito Alta |
| **GCP (básico)** | $15-24 | R$ 75-120 | Alta | Muito Alta |
| **Azure (básico)** | $36 | R$ 180 | Alta | Muito Alta |
| **PythonAnywhere** | $5 | R$ 25 | Baixa | Baixa |

---

## 🎯 Recomendações por Cenário

### 1. **MVP / Prototipagem (Custo mínimo)**
**Recomendação: Fly.io ou Railway.app**
- **Custo:** R$ 0-50/mês
- **Razão:** Free tier generoso, deploy simples, adequado para validação
- **Migração:** Fácil migração posterior para outras plataformas

### 2. **Projeto Acadêmico / Demonstração**
**Recomendação: Render.com**
- **Custo:** R$ 70/mês
- **Razão:** Equilíbrio entre custo, facilidade e features profissionais
- **Benefícios:** SSL, logs, monitoramento, deploy automático

### 3. **Produção Inicial (Até 500 usuários)**
**Recomendação: VPS Contabo + Nginx + PostgreSQL**
- **Custo:** R$ 50/mês
- **Razão:** Melhor custo-benefício, controle total, recursos abundantes
- **Requisitos:** Conhecimento em DevOps ou tempo para configurar

### 4. **Produção Média (500-5000 usuários)**
**Recomendação: Digital Ocean Droplet + Managed Database**
- **Custo:** R$ 120-200/mês
- **Razão:** Confiabilidade, backups automáticos, suporte
- **Benefícios:** Separação de concerns, escalabilidade facilitada

### 5. **Produção Enterprise (5000+ usuários)**
**Recomendação: AWS/GCP com arquitetura escalável**
- **Custo:** R$ 300-1000+/mês
- **Razão:** Auto-scaling, alta disponibilidade, performance
- **Arquitetura:** Load balancer, múltiplas instâncias, CDN, cache (Redis)

---

## 🔧 Configurações Adicionais Necessárias

### Variáveis de Ambiente (Produção)

```bash
# Backend (.env)
DEBUG=False
SECRET_KEY=<chave-segura-gerada>
DB_NAME=commander150
DB_USER=<usuario-db>
DB_PASSWORD=<senha-segura>
DB_HOST=<host-do-banco>
EMAIL_USER=<email-smtp>
EMAIL_PASSWORD=<senha-app-gmail>
CORS_ALLOWED_ORIGINS=https://commander150.com,https://www.commander150.com
ALLOWED_HOSTS=api.commander150.com,.commander150.com
```

```bash
# Frontend (.env)
VITE_API_URL=https://api.commander150.com/api/v1
```

### Melhorias de Segurança

```python
# settings.py (Produção)
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
```

### Monitoramento e Logs

**Opções Gratuitas:**
- **Sentry** (error tracking) - Free tier: 5k eventos/mês
- **Uptime Robot** (monitoring) - Free: 50 monitores
- **Google Analytics** - Gratuito

**Opções Pagas:**
- **New Relic** - $99/mês (APM completo)
- **Datadog** - $15/host/mês
- **Papertrail** - $7/mês (logs centralizados)

---

## 📈 Projeção de Custos por Crescimento

### Cenário Conservador

| Fase | Usuários | Solução | Custo Mensal |
|------|----------|---------|--------------|
| **Beta** | 0-50 | Fly.io/Railway | R$ 0-50 |
| **Lançamento** | 50-200 | Render.com | R$ 70 |
| **Crescimento** | 200-1000 | VPS Contabo 8GB | R$ 100 |
| **Escala** | 1000-5000 | Digital Ocean 8GB + Managed DB | R$ 250 |
| **Enterprise** | 5000+ | AWS/GCP Auto-scaling | R$ 500-2000 |

### Custos Adicionais Potenciais

| Item | Quando Necessário | Custo Estimado |
|------|-------------------|----------------|
| **CDN (Cloudflare Pro)** | >10k visitas/dia | $20/mês |
| **Email Transacional** | >500 emails/mês | $10-50/mês |
| **Backup Externo** | Sempre (recomendado) | $5-10/mês |
| **Redis/Cache** | >1000 usuários ativos | $7-15/mês |
| **Monitoramento APM** | Produção | $0-100/mês |
| **Domínio + SSL** | Sempre | $1-2/mês (SSL gratuito com Let's Encrypt) |

---

## 🚦 Plano de Ação Recomendado

### Fase 1: Desenvolvimento e Testes (Atual)
- **Ambiente:** Local (Docker Compose)
- **Custo:** R$ 0
- **Duração:** Em andamento

### Fase 2: Deploy Beta (Próximos passos)
- **Plataforma:** Render.com ou Railway.app
- **Custo:** R$ 50-70/mês
- **Configuração:**
  1. Criar conta na plataforma escolhida
  2. Configurar variáveis de ambiente
  3. Conectar repositório Git
  4. Deploy automático do backend
  5. Deploy do frontend como static site
  6. Configurar domínio personalizado

### Fase 3: Lançamento Público
- **Plataforma:** VPS (Contabo ou Digital Ocean)
- **Custo:** R$ 50-150/mês
- **Ações:**
  1. Provisionar servidor
  2. Configurar Nginx + Gunicorn
  3. Setup PostgreSQL
  4. Configurar SSL (Let's Encrypt)
  5. Implementar CI/CD (GitHub Actions)
  6. Configurar backups automáticos
  7. Setup monitoramento (Uptime Robot + Sentry)

### Fase 4: Otimização e Escala
- **Quando:** >1000 usuários ativos ou performance degradada
- **Ações:**
  1. Implementar Redis para cache de sessões
  2. CDN para assets estáticos (Cloudflare)
  3. Otimização de queries (índices, N+1)
  4. Considerar migração para arquitetura escalável (AWS/GCP)

---

## 📝 Checklist de Deploy

### Pré-Deploy
- [ ] Testes unitários passando
- [ ] Testes de integração validados
- [ ] Configurações de produção revisadas
- [ ] Secrets/chaves geradas e seguras
- [ ] Variáveis de ambiente documentadas
- [ ] Backup do banco de dados local

### Deploy Backend
- [ ] Dependências instaladas (requirements.txt)
- [ ] Migrações executadas
- [ ] Arquivos estáticos coletados (collectstatic)
- [ ] Gunicorn configurado e rodando
- [ ] Nginx configurado (reverse proxy)
- [ ] SSL configurado (Let's Encrypt)
- [ ] Logs configurados
- [ ] Supervisor/systemd configurado

### Deploy Frontend
- [ ] Build de produção gerado (npm run build)
- [ ] Variável VITE_API_URL configurada
- [ ] Assets copiados para servidor
- [ ] Nginx configurado (SPA routing)
- [ ] Cache headers configurados
- [ ] Testes de rotas validados

### Pós-Deploy
- [ ] Smoke tests executados
- [ ] Monitoramento configurado
- [ ] Backups agendados
- [ ] Domínio apontando corretamente
- [ ] CORS validado
- [ ] Emails de teste enviados
- [ ] Documentação de deploy atualizada

---

## 🔐 Considerações de Segurança

### Backend Django
```python
# Checklist de Segurança
✓ DEBUG=False em produção
✓ SECRET_KEY único e seguro
✓ ALLOWED_HOSTS configurado
✓ CORS restrito a domínios específicos
✓ HTTPS obrigatório (SECURE_SSL_REDIRECT)
✓ Cookies seguros (SESSION_COOKIE_SECURE)
✓ Headers de segurança configurados
✓ Rate limiting (django-ratelimit)
✓ SQL Injection protegido (ORM Django)
✓ XSS protegido (templates Django)
✓ CSRF protegido (middleware Django)
```

### Frontend React
```javascript
// Checklist de Segurança
✓ Variáveis sensíveis não commitadas
✓ API_URL via environment variables
✓ Validação de inputs
✓ Sanitização de dados de usuário
✓ HTTPS obrigatório
✓ Content Security Policy configurada
✓ Dependências atualizadas (npm audit)
```

### Infraestrutura
- [ ] Firewall configurado (apenas portas 80, 443, 22)
- [ ] SSH com chave pública (desabilitar senha)
- [ ] Usuário não-root para aplicação
- [ ] Fail2ban configurado
- [ ] Backups automáticos e testados
- [ ] Monitoramento de recursos (CPU, RAM, Disco)
- [ ] Logs centralizados e rotacionados

---

## 📚 Recursos e Scripts Úteis

### Script de Backup Automático

```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/commander150"
DB_NAME="commander150"

# Criar diretório de backup
mkdir -p $BACKUP_DIR

# Backup PostgreSQL
pg_dump $DB_NAME | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Backup arquivos de mídia (se houver)
tar -czf $BACKUP_DIR/media_$DATE.tar.gz /var/www/backend/media/

# Manter apenas últimos 7 backups
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +7 -delete
find $BACKUP_DIR -name "media_*.tar.gz" -mtime +7 -delete

echo "Backup concluído: $DATE"
```

### GitHub Actions CI/CD

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Deploy to Server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /var/www/backend
            git pull origin main
            source venv/bin/activate
            pip install -r requirements.txt
            python manage.py migrate
            python manage.py collectstatic --noinput
            sudo supervisorctl restart gunicorn

  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Build
        run: |
          cd frontend
          npm install
          npm run build

      - name: Deploy to Server
        uses: appleboy/scp-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          source: "frontend/dist/*"
          target: "/var/www/frontend/"
```

---

## 🎓 Conclusão

Para o projeto **Commander 150**, considerando:
- Natureza acadêmica inicial
- Necessidade de aprendizado prático
- Orçamento limitado
- Possibilidade de crescimento futuro

### Recomendação Final:

**Para Apresentação/Beta (Imediato):**
→ **Render.com** (R$ 70/mês)
- Deploy em 30 minutos
- Zero configuração de servidor
- SSL, logs, monitoramento inclusos
- Excelente para demonstração ao orientador e comunidade

**Para Produção/Longo Prazo (3-6 meses):**
→ **VPS Contabo ou Digital Ocean** (R$ 50-120/mês)
- Melhor custo-benefício
- Controle total
- Aprendizado completo de DevOps
- Escalabilidade conforme necessidade

**Roadmap de Migração:**
1. **Agora:** Deploy no Render.com para validação
2. **Após feedback:** Preparar infraestrutura VPS
3. **Migração:** Executar migração em janela de manutenção
4. **Futuro:** Escalar conforme crescimento real da base de usuários

---

## 📞 Próximos Passos

1. **Decidir plataforma de deploy inicial**
2. **Criar contas e configurar credenciais**
3. **Preparar documentação de configuração**
4. **Implementar CI/CD básico**
5. **Executar primeiro deploy**
6. **Monitorar e iterar**

---

**Documento criado em:** 01/10/2025
**Última atualização:** 01/10/2025
**Responsável:** Equipe Commander 150
**Status:** Em análise
