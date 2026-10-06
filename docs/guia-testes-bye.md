# 🧪 GUIA DE TESTES - BYE NOS CRITÉRIOS DE DESEMPATE

## 📋 OBJETIVO

Validar que byes são **EXCLUÍDOS de todos os critérios de desempate** mas **INCLUÍDOS na pontuação total**.

---

## 🎯 CENÁRIOS DE TESTE

### ✅ TESTE 1: BYE AUMENTA PONTOS MAS NÃO MW%

**Objetivo:** Verificar que bye adiciona pontos mas não "infla" o MW%

#### Configuração:
```
Torneio: 4 rodadas, 8 jogadores, 3 pts por vitória
```

#### Passos:

1. **Criar torneio e jogadores**
   ```
   - Torneio "Teste Bye 1"
   - 8 jogadores inscritos
   - Pontuação: Vitória=3, Empate=1, Derrota=0, Bye=3
   ```

2. **Simular rodadas com resultados específicos**

   **Jogador A (com bye na R3):**
   ```
   R1: Vitória  → 3 pts
   R2: Vitória  → 3 pts
   R3: BYE      → 3 pts
   R4: Derrota  → 0 pts
   Total: 9 pts
   ```

   **Jogador B (sem bye):**
   ```
   R1: Vitória  → 3 pts
   R2: Vitória  → 3 pts
   R3: Derrota  → 0 pts
   R4: Derrota  → 0 pts
   Total: 6 pts
   ```

3. **Verificar ranking após R4**
   ```bash
   GET /api/v1/torneios/{id}/ranking_rodada/?rodada_id={rodada4_id}
   ```

#### ✅ Resultado Esperado:

```json
{
  "ranking": [
    {
      "posicao": 1,
      "jogador_nome": "Jogador A",
      "pontos": 9,                    // ← INCLUI bye (3+3+3+0)
      "mw_percentage": 0.6667,        // ← EXCLUI bye (6/9 = 66.7%)
      "balanco": "...",
      "omw_percentage": "...",
      "pmw_percentage": "..."
    },
    {
      "posicao": 2,
      "jogador_nome": "Jogador B",
      "pontos": 6,                    // ← Sem bye (3+3+0+0)
      "mw_percentage": 0.5000,        // ← 6/12 = 50%
      "balanco": "...",
      "omw_percentage": "...",
      "pmw_percentage": "..."
    }
  ]
}
```

#### ✅ Validações:

- [ ] Jogador A tem **9 pontos** (inclui bye)
- [ ] Jogador A tem **MW% = 66.7%** (6 pts em 3 rodadas reais)
- [ ] Jogador B tem **6 pontos**
- [ ] Jogador B tem **MW% = 50%** (6 pts em 4 rodadas)
- [ ] Jogador A está em **1º lugar** (mais pontos)

---

### ✅ TESTE 2: DESEMPATE EM PONTOS COM BYE

**Objetivo:** Verificar que desempate usa apenas partidas reais

#### Configuração:
```
Torneio: 5 rodadas, 10 jogadores, 3 pts por vitória
```

#### Passos:

1. **Criar torneio**

2. **Simular cenário de empate**

   **Jogador A (teve bye na R2):**
   ```
   R1: Vitória  → 3 pts
   R2: BYE      → 3 pts
   R3: Vitória  → 3 pts
   R4: Derrota  → 0 pts
   R5: Vitória  → 3 pts
   Total: 12 pts
   ```

   **Jogador B (sem bye):**
   ```
   R1: Vitória  → 3 pts
   R2: Derrota  → 0 pts
   R3: Vitória  → 3 pts
   R4: Vitória  → 3 pts
   R5: Vitória  → 3 pts
   Total: 12 pts
   ```

3. **Verificar ranking após R5**

#### ✅ Resultado Esperado:

```json
{
  "ranking": [
    {
      "posicao": 1,
      "jogador_nome": "Jogador B",
      "pontos": 12,
      "mw_percentage": 0.8000,        // ← 12/15 = 80% (5 rodadas)
      "balanco": "..."
    },
    {
      "posicao": 2,
      "jogador_nome": "Jogador A",
      "pontos": 12,
      "mw_percentage": 0.7500,        // ← 9/12 = 75% (4 rodadas)
      "balanco": "..."
    }
  ]
}
```

#### ✅ Validações:

- [ ] Ambos têm **12 pontos** (empate no 1º critério)
- [ ] Jogador B tem **MW% = 80%** (4 vitórias em 5 partidas)
- [ ] Jogador A tem **MW% = 75%** (3 vitórias em 4 partidas)
- [ ] **Jogador B vence no desempate** (maior MW% ou balanço)

---

### ✅ TESTE 3: OMW% COM OPONENTE QUE TEVE BYE

**Objetivo:** Verificar que bye do oponente não afeta cálculo de OMW%

#### Configuração:
```
Torneio: 4 rodadas, 6 jogadores
```

#### Passos:

1. **Criar torneio**

2. **Simular cenário específico**

   **Jogador A:**
   ```
   R1: Enfrenta Jogador C (vence)
   R2: Enfrenta Jogador D (vence)
   R3: Enfrenta Jogador E (perde)
   R4: Enfrenta Jogador F (vence)
   ```

   **Jogador C (oponente de A na R1):**
   ```
   R1: Enfrenta Jogador A (perde) → 0 pts
   R2: BYE                        → 3 pts
   R3: Vitória                    → 3 pts
   R4: Vitória                    → 3 pts
   ```

3. **Verificar OMW% de A**

#### ✅ Resultado Esperado:

```
Jogador A enfrentou: C, D, E, F

MW% ajustado de C (excluindo R1 e R2-bye):
- R3: 3 pts
- R4: 3 pts
- MW%_C = 6 / (2×3) = 100%  ← Apenas 2 rodadas válidas (sem bye)

OMW%_A = média(MW%_C, MW%_D, MW%_E, MW%_F)
```

#### ✅ Validações:

- [ ] MW% ajustado de C **não inclui o bye da R2**
- [ ] MW% ajustado de C é calculado **apenas com R3 e R4**
- [ ] OMW% de A reflete força real dos oponentes

---

### ✅ TESTE 4: PMW% COM PARCEIRO QUE TEVE BYE

**Objetivo:** Verificar que bye do parceiro não afeta cálculo de PMW%

#### Configuração:
```
Torneio: 4 rodadas, 6 jogadores
```

#### Passos:

1. **Criar torneio**

2. **Simular cenário específico**

   **Jogador A:**
   ```
   R1: Time com Jogador B (vence)
   R2: Time com Jogador C (vence)
   R3: Time com Jogador D (perde)
   R4: Time com Jogador E (vence)
   ```

   **Jogador B (parceiro de A na R1):**
   ```
   R1: Time com Jogador A (vence) → 3 pts
   R2: BYE                        → 3 pts
   R3: Derrota                    → 0 pts
   R4: Vitória                    → 3 pts
   ```

3. **Verificar PMW% de A**

#### ✅ Resultado Esperado:

```
Jogador A teve como parceiros: B, C, D, E

MW% ajustado de B (excluindo R1 e R2-bye):
- R3: 0 pts
- R4: 3 pts
- MW%_B = 3 / (2×3) = 50%  ← Apenas 2 rodadas válidas (sem bye)

PMW%_A = média(MW%_B, MW%_C, MW%_D, MW%_E)
```

#### ✅ Validações:

- [ ] MW% ajustado de B **não inclui o bye da R2**
- [ ] MW% ajustado de B é calculado **apenas com R3 e R4**
- [ ] PMW% de A reflete força real dos parceiros

---

### ✅ TESTE 5: MÚLTIPLOS JOGADORES COM BYE

**Objetivo:** Verificar que sistema funciona com vários jogadores tendo bye

#### Configuração:
```
Torneio: 5 rodadas, 9 jogadores (número ímpar → sempre 1 bye por rodada)
```

#### Passos:

1. **Criar torneio com 9 jogadores**

2. **Executar 5 rodadas completas**
   - Em cada rodada, 1 jogador diferente tem bye
   - Sistema de emparelhamento automático

3. **Verificar ranking final**

#### ✅ Resultado Esperado:

```json
{
  "ranking": [
    {
      "posicao": 1,
      "jogador_nome": "Jogador X",
      "pontos": 15,
      "mw_percentage": 0.7500,     // ← Calculado sem bye
      "omw_percentage": 0.6200,    // ← Calculado sem byes dos oponentes
      "pmw_percentage": 0.5800,    // ← Calculado sem byes dos parceiros
      "balanco": 0.0400
    },
    // ... outros jogadores
  ]
}
```

#### ✅ Validações:

- [ ] Todos os jogadores tiveram exatamente **1 bye**
- [ ] Pontos totais **incluem bye** (3 pts)
- [ ] MW%, OMW%, PMW% **excluem byes**
- [ ] Ranking está ordenado corretamente
- [ ] Balanço reflete apenas partidas reais

---

## 🔍 VALIDAÇÃO MANUAL VIA API

### 1. Listar Torneios
```bash
GET /api/v1/torneios/
```

### 2. Ver Detalhes de um Torneio
```bash
GET /api/v1/torneios/{id}/
```

### 3. Ver Ranking de uma Rodada
```bash
GET /api/v1/torneios/{id}/ranking_rodada/?rodada_id={rodada_id}
```

**Resposta esperada:**
```json
{
  "rodada_numero": 3,
  "ranking": [
    {
      "posicao": 1,
      "jogador_id": 5,
      "jogador_nome": "carlos.silva",
      "pontos": 9,
      "mw_percentage": 0.6667,
      "omw_percentage": 0.5500,
      "pmw_percentage": 0.4500,
      "balanco": 0.1000
    }
  ]
}
```

### 4. Ver Ranking Final
```bash
GET /api/v1/torneios/{id}/ranking_final/
```

---

## 🧮 CÁLCULO MANUAL (Para Verificação)

### Fórmula MW% sem bye:

```python
pontos_reais = 0
rodadas_reais = 0

for rodada in rodadas:
    if rodada.tem_parceiro:  # Não é bye
        pontos_reais += rodada.pontos
        rodadas_reais += 1

MW% = pontos_reais / (rodadas_reais × 3)
```

### Exemplo:
```
Rodadas: [V(3), BYE(3), V(3), D(0), V(3)]

pontos_reais = 3 + 3 + 0 + 3 = 9
rodadas_reais = 4 (exclui bye)

MW% = 9 / (4 × 3) = 9/12 = 0.75 = 75% ✅
```

---

## 🐛 DEBUG

### Ver Cache de Ranking no Banco

```sql
SELECT
    rp.rodada_numero,
    u.username,
    rp.pontos_totais,
    rp.mw_percentage,
    rp.omw_percentage,
    rp.pmw_percentage,
    rp.balanco,
    rp.posicao
FROM torneios_rankingparcial rp
JOIN auth_user u ON rp.id_usuario_id = u.id
WHERE rp.id_torneio_id = <TORNEIO_ID>
ORDER BY rp.rodada_numero, rp.posicao;
```

### Ver Inscrições e Jogadores

```sql
SELECT
    t.nome AS torneio,
    u.username AS jogador,
    i.status
FROM torneios_inscricao i
JOIN torneios_torneio t ON i.id_torneio_id = t.id
JOIN auth_user u ON i.id_usuario_id = u.id
WHERE t.id = <TORNEIO_ID>;
```

### Ver Mesas e Resultados

```sql
SELECT
    r.numero_rodada,
    m.id AS mesa_id,
    m.time_vencedor,
    u.username AS jogador,
    jm.time
FROM torneios_mesa m
JOIN torneios_rodada r ON m.id_rodada_id = r.id
JOIN torneios_jogadormesa jm ON jm.id_mesa_id = m.id
JOIN auth_user u ON jm.id_usuario_id = u.id
WHERE r.id_torneio_id = <TORNEIO_ID>
ORDER BY r.numero_rodada, m.id, jm.time;
```

---

## 📊 CHECKLIST GERAL

### Antes de Testar:
- [ ] Código atualizado em `ranking.py`
- [ ] Servidor Django reiniciado
- [ ] Banco de dados acessível

### Durante os Testes:
- [ ] ✅ TESTE 1 concluído e validado
- [ ] ✅ TESTE 2 concluído e validado
- [ ] ✅ TESTE 3 concluído e validado
- [ ] ✅ TESTE 4 concluído e validado
- [ ] ✅ TESTE 5 concluído e validado

### Validações Finais:
- [ ] MW% sempre <= 100%
- [ ] OMW% sempre <= 100%
- [ ] PMW% sempre <= 100%
- [ ] Balanço pode ser negativo
- [ ] Posições no ranking são únicas
- [ ] Ordenação segue critérios em cascata

---

## 🚨 PROBLEMAS COMUNS

### 1. **MW% > 100%**
**Causa:** Bug no cálculo
**Solução:** Verificar que `rodadas_reais` não está sendo contada errado

### 2. **MW% = 0% para jogador com vitórias**
**Causa:** Bye está sendo excluído incorretamente
**Solução:** Verificar condição `parceiro is not None`

### 3. **Ranking não muda após atualização**
**Causa:** Cache antigo no banco
**Solução:** Deletar `RankingParcial` e recalcular

```python
RankingParcial.objects.filter(id_torneio_id=<ID>).delete()
```

### 4. **OMW% ou PMW% = 0%**
**Causa:** Todos os oponentes/parceiros retornaram `None`
**Solução:** Verificar se há rodadas válidas suficientes

---

## 📝 TEMPLATE DE REPORTE DE BUG

Se encontrar um bug, reporte com estas informações:

```markdown
**Descrição:**
[Descreva o problema]

**Passos para Reproduzir:**
1. Criar torneio com X jogadores
2. Simular rodadas: [listar resultados]
3. Verificar ranking

**Resultado Esperado:**
[O que deveria acontecer]

**Resultado Obtido:**
[O que aconteceu]

**Dados de Debug:**
- Torneio ID:
- Rodada:
- Jogador:
- Pontos esperados:
- MW% esperado:
- MW% obtido:

**SQL Debug:**
```sql
[Query SQL para debug]
```

**Logs:**
```
[Logs do servidor Django]
```
```

---

## ✅ APROVAÇÃO FINAL

Após executar todos os testes:

- [ ] Todos os 5 testes passaram
- [ ] Validações manuais confirmadas
- [ ] Cálculos verificados manualmente
- [ ] Sem erros no console
- [ ] Performance adequada (< 1s para calcular ranking)

**Aprovado por:** _______________
**Data:** _______________

---

**Última atualização:** 2024-12-24
**Versão:** 1.0
