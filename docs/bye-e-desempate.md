# 🎯 TRATAMENTO DE BYE NOS CRITÉRIOS DE DESEMPATE

## 📋 RESUMO

A partir desta implementação, **byes são EXCLUÍDOS de todos os cálculos de critérios de desempate** (tiebreakers), mas **INCLUÍDOS na pontuação total** para classificação geral.

---

## 🔑 REGRA PRINCIPAL

```
┌────────────────────────────────────────────────────────────┐
│  BYE = Pontos para classificação, mas NÃO para desempate  │
└────────────────────────────────────────────────────────────┘
```

**Justificativa:**
- Bye não representa habilidade ou mérito competitivo
- É apenas sorte/necessidade de balanceamento do torneio
- Critérios de desempate devem refletir apenas **performance em partidas reais**

---

## 📊 COMO FUNCIONA

### ✅ BYE CONTA PARA:

#### 1. **Pontuação Total (1º Critério de Classificação)**
```python
# Jogador com bye recebe pontos normalmente
pontos_totais = sum(pontos_por_rodada[jogador_id].values())
# INCLUI pontos do bye
```

**Exemplo:**
```
Jogador A:
- R1: 3 pts (vitória)
- R2: 3 pts (bye)      ← CONTA para pontos totais
- R3: 0 pts (derrota)
- R4: 3 pts (vitória)

Pontos Totais = 3 + 3 + 0 + 3 = 9 pts ✅
```

---

### ❌ BYE NÃO CONTA PARA:

#### 1. **MW% (Match Win Percentage)**
```python
# Bye é ignorado - apenas partidas reais contam
for r in range(1, rodada_numero + 1):
    parceiro = parceiros_hist.get(r)
    if parceiro is not None:  # ← Se parceiro é None = bye
        pontos_reais += pontos_por_rodada[r]
        rodadas_reais += 1

MW% = pontos_reais / (rodadas_reais × pontos_por_vitoria)
```

**Exemplo:**
```
Jogador A:
- R1: 3 pts (vitória)  ✅
- R2: 3 pts (bye)      ❌ NÃO conta
- R3: 0 pts (derrota)  ✅
- R4: 3 pts (vitória)  ✅

MW% = (3 + 0 + 3) / (3 × 3) = 6/9 = 66.7%
# Apenas 3 rodadas consideradas (sem o bye)
```

---

#### 2. **OMW% (Opponent Match Win %)**
```python
# MW% ajustado dos oponentes também exclui byes
for oponente_id in oponentes_unicos:
    mw_ajustado = calcular_mw_ajustado(oponente_id, jogador_id)
    # ↑ Esta função exclui byes do oponente
```

**Como funciona:**
- Calcula MW% de cada oponente (sem contar byes deles)
- Faz a média dos MW% ajustados

---

#### 3. **PMW% (Partner Match Win %)**
```python
# MW% ajustado dos parceiros também exclui byes
for parceiro_id in parceiros_unicos:
    mw_ajustado = calcular_mw_ajustado(parceiro_id, jogador_id)
    # ↑ Esta função exclui byes do parceiro
```

**Como funciona:**
- Calcula MW% de cada parceiro (sem contar byes deles)
- Faz a média dos MW% ajustados

---

#### 4. **Balanço (OMW% - PMW%)**
```python
balanco = omw - pmw
# ↑ Como OMW% e PMW% já excluem byes, o balanço também exclui
```

---

## 🔍 EXEMPLO COMPLETO

### Cenário: Torneio com 5 rodadas

```
Jogador A (teve 1 bye na R3):
┌─────────┬──────────┬──────────────┬────────────────┐
│ Rodada  │ Resultado│ Pontos       │ Conta para MW%?│
├─────────┼──────────┼──────────────┼────────────────┤
│ R1      │ Vitória  │ 3            │ ✅ SIM         │
│ R2      │ Derrota  │ 0            │ ✅ SIM         │
│ R3      │ BYE      │ 3            │ ❌ NÃO         │
│ R4      │ Vitória  │ 3            │ ✅ SIM         │
│ R5      │ Vitória  │ 3            │ ✅ SIM         │
└─────────┴──────────┴──────────────┴────────────────┘

PONTUAÇÃO TOTAL (para classificação):
= 3 + 0 + 3 + 3 + 3 = 12 pts ✅ (INCLUI bye)

MW% (para desempate):
= (3 + 0 + 3 + 3) / (4 × 3) = 9/12 = 75% ✅ (EXCLUI bye)
```

### Comparação com Jogador B (sem bye):

```
Jogador B (sem bye):
┌─────────┬──────────┬──────────────┬────────────────┐
│ Rodada  │ Resultado│ Pontos       │ Conta para MW%?│
├─────────┼──────────┼──────────────┼────────────────┤
│ R1      │ Vitória  │ 3            │ ✅ SIM         │
│ R2      │ Derrota  │ 0            │ ✅ SIM         │
│ R3      │ Empate   │ 1            │ ✅ SIM         │
│ R4      │ Vitória  │ 3            │ ✅ SIM         │
│ R5      │ Vitória  │ 3            │ ✅ SIM         │
└─────────┴──────────┴──────────────┴────────────────┘

PONTUAÇÃO TOTAL:
= 3 + 0 + 1 + 3 + 3 = 10 pts

MW% (para desempate):
= (3 + 0 + 1 + 3 + 3) / (5 × 3) = 10/15 = 66.7%
```

### Resultado do Desempate:

```
EMPATE EM PONTUAÇÃO? NÃO!

Classificação:
1º - Jogador A: 12 pts
2º - Jogador B: 10 pts

(Jogador A vence pelo 1º critério: pontos totais)
```

### Cenário de Empate em Pontos:

```
Se ambos tivessem 12 pts:

Jogador A:
- Pontos: 12
- MW%: 75% (3 vitórias em 4 partidas)

Jogador B:
- Pontos: 12
- MW%: 80% (4 vitórias em 5 partidas)

✅ Jogador B vence no desempate (MW% superior)!
```

---

## 🎯 CRITÉRIOS DE DESEMPATE FINAIS

Com byes excluídos, a ordem de desempate é:

```
1º - Pontuação Total (INCLUI bye)
    ↓ Se empatar...
2º - Balanço (OMW% - PMW%) (EXCLUI bye)
    ↓ Se empatar...
3º - OMW% (EXCLUI bye)
    ↓ Se empatar...
4º - MW% (EXCLUI bye)
```

---

## 💻 IMPLEMENTAÇÃO TÉCNICA

### Função `calcular_metricas_jogador()`

**Localização:** `backend/torneios/ranking.py`

```python
# Pontos Totais - INCLUI bye
pontos_totais = dados['mw_base'][jogador_id]

# MW% - EXCLUI byes
pontos_reais = 0
rodadas_reais = 0

for r in range(1, rodada_numero + 1):
    if r in pontos_por_rodada:
        parceiro = parceiros_hist.get(r)
        # Se parceiro é None, é bye - ignorar
        if parceiro is not None:
            pontos_reais += pontos_por_rodada[r]
            rodadas_reais += 1

# MW% baseado apenas em partidas reais
pontos_maximos = rodadas_reais * torneio.pontuacao_vitoria
mw = pontos_reais / pontos_maximos if pontos_maximos > 0 else 0
mw = max(mw, 0.01)  # Floor de 1%
```

### Função `calcular_mw_ajustado()`

**Localização:** `backend/torneios/ranking.py`

```python
for r in range(1, rodada_numero + 1):
    # Verificar se o jogador_alvo teve bye nesta rodada
    parceiro_alvo = dados['parceiros'][jogador_alvo].get(r)
    if parceiro_alvo is None:
        # É bye - ignorar esta rodada completamente
        continue

    # Verificar se jogaram juntos...
    # (resto do código)
```

---

## 🧪 CASOS ESPECIAIS

### 1. **Jogador que só teve byes (hipotético)**
```python
MW% = 0 / 0 → 0 → Aplica floor de 1%
Resultado: MW% = 1% (mínimo)
```

### 2. **Jogador teve bye + jogou contra/com alguém que teve bye**
```python
# No cálculo de MW% ajustado:
- Ignora rodada do bye (parceiro = None)
- Ignora rodadas compartilhadas
- Calcula MW% apenas com rodadas válidas restantes
```

### 3. **Todos os jogadores tiveram pelo menos 1 bye**
```python
# Todos têm byes desconsiderados igualmente
# Desempate acontece normalmente baseado nas partidas reais
```

---

## 📝 CHECKLIST DE TESTES

Para validar a implementação, teste os seguintes cenários:

### ✅ Teste 1: Bye aumenta pontos mas não MW%
- [ ] Jogador com bye tem mais pontos totais
- [ ] Mas MW% menor (se performance real for pior)

### ✅ Teste 2: Desempate com bye
- [ ] Dois jogadores empatados em pontos
- [ ] Um com bye, outro sem
- [ ] Desempate considera apenas partidas reais

### ✅ Teste 3: OMW% com oponente que teve bye
- [ ] Oponente teve bye
- [ ] Seu OMW% ignora o bye do oponente

### ✅ Teste 4: PMW% com parceiro que teve bye
- [ ] Parceiro teve bye
- [ ] Seu PMW% ignora o bye do parceiro

### ✅ Teste 5: Ranking final
- [ ] Ranking está ordenado corretamente
- [ ] Balanço reflete apenas partidas reais

---

## 🔄 MIGRAÇÃO

**Não é necessária migration de banco de dados!**

Esta é uma mudança apenas na **lógica de cálculo**. O modelo `RankingParcial` permanece o mesmo.

### O que fazer:

1. ✅ Atualizar código (já feito)
2. ✅ Reiniciar servidor Django
3. ✅ Testar com torneio existente
4. ⚠️ Rankings anteriores salvos em cache podem estar com cálculo antigo
5. ✅ Ao finalizar próxima rodada, novo cálculo será aplicado

### Para recalcular rankings antigos:

```bash
# Django shell
python manage.py shell

from torneios.models import Torneio, RankingParcial
from torneios.ranking import calcular_e_salvar_ranking_parcial

# Deletar cache antigo
RankingParcial.objects.filter(id_torneio_id=<TORNEIO_ID>).delete()

# Recalcular
torneio = Torneio.objects.get(id=<TORNEIO_ID>)
calcular_e_salvar_ranking_parcial(torneio, <RODADA_NUMERO>)
```

---

## 📚 DOCUMENTAÇÃO RELACIONADA

- **ALGORITMO_PAREAMENTO_2V2.md** - Documentação completa do algoritmo
- **ranking.py** - Código de implementação
- **GUIA_TESTES_BYE.md** - Guia detalhado de testes (próximo arquivo)

---

## ✅ STATUS

**Implementação:** ✅ COMPLETA
**Testes:** ⏳ PENDENTE
**Deploy:** ⏳ PENDENTE

---

## 📞 SUPORTE

Em caso de dúvidas sobre o tratamento de byes:

1. Consulte esta documentação
2. Verifique os exemplos práticos acima
3. Execute os testes do guia de testes
4. Analise o código em `ranking.py`

---

**Última atualização:** 2024-12-24
**Versão:** 1.0
