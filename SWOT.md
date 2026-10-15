# D-Stamp · Análise SWOT (FOFA) e plano de reposicionamento do site

**Data:** 12/10/2026 · **Escopo:** site/MVP `dstamp` (vitrine + checkout + acompanhamento + painel da equipe)
**Referência de negócio:** loja oficial [dstamp.com.br](https://www.dstamp.com.br) · D-Stamp Estamparia, Confecção e Brindes — Av. Presidente Kennedy, 6545, Praia Grande/SP · (13) 99669-9067

---

## 1. Leitura do cenário (o ponto de partida)

A D-Stamp já vende **insumos, peças lisas e brindes** num e-commerce pronto (Nuvem Shop), com frete para todo o Brasil e parcelamento em até 12x.
O que **não** está bem servido hoje é o serviço de maior valor: **estamparia sob encomenda** — em especial a **estampa total (personalização total)**, que é produção própria, por lote de sábado, com prazo de 15 a 20 dias.

Esse serviço hoje vive quase inteiro no **WhatsApp**: funciona, mas não escala, não deixa rastro, não mostra prazo real, não valida arte, não controla pagamento e depende de uma pessoa responder.

**Decisão estratégica adotada nesta versão:** o site deixa de tentar ser "mais uma loja" e passa a ser **o funil explicativo + o coletor de pedido da estampa total**, com a estampa localizada (sublimação/DTF) e os brindes encaminhados para o WhatsApp — onde a conversa de orçamento já acontece naturalmente.

---

## 2. SWOT

### 🟢 Forças (interno · o que já é bom)

| # | Força | Por que importa |
|---|---|---|
| F1 | **Produção própria de estampa total** (sublimação em Dry Fit e Poliflex), de 1 peça a lote | Concorrente local normalmente exige mínimo alto; aqui não existe mínimo |
| F2 | **Tabela de preço fechada e previsível** (R$55 até 10 / R$50 acima de 10; Poliflex R$65/R$60; +R$5,50 manga longa; +R$1,50 gola V; +R$3,00 por tamanho acima do GG) | Dá para mostrar preço na tela sem "fale conosco" — reduz fricção e filtra curioso |
| F3 | **Grade ampla de tamanhos** (PP ao GG + EXG, G1 a G6; infantil 2 a 14) | Atende time, escola, empresa e público plus size — poucos fazem isso |
| F4 | **Duas técnicas dominadas** (sublimação localizada e DTF têxtil) + estampa em peça de terceiros | Cobre peça clara, peça escura e peça do cliente |
| F5 | **Loja oficial já operando** (dstamp.com.br) com insumos, lisos, canecas e garrafas | Marca validada, CNPJ, histórico de venda e base de revendedores |
| F6 | **Ponto físico em Praia Grande** com retirada | Frete zero para o cliente local, confiança para pagamento na retirada |
| F7 | **Processo interno já mapeado no MVP**: 9 etapas, chamados numerados (ALT/ACO/FIN/ERR), validação de comprovante com código REC-####, ficha do designer por tipo de peça, export Olist/Sysloja | Operação auditável; menos retrabalho e menos "cadê meu pedido?" |
| F8 | **Atendimento próximo** (WhatsApp direto com quem produz) | Alto índice de recompra em uniformes/abadás |

### 🔴 Fraquezas (interno · o que atrapalha)

| # | Fraqueza | Impacto |
|---|---|---|
| W1 | **Todo o pedido de estamparia passa pelo WhatsApp** → sem histórico, sem fila, sem prazo visível | Esquecimento, retrabalho, cliente perguntando "quando fica pronto?" |
| W2 | **Capacidade rígida**: 250 peças/semana só de estampa total, produzida em lote de sábado | Pedido grande fora da janela = perda de venda ou prazo esticado |
| W3 | **Prazo longo** (15–20 dias) para o padrão do e-commerce (2–5 dias) | Precisa ser explicado *antes* do carrinho, senão vira reclamação |
| W4 | **Dependência de arte do cliente**: arquivo ruim, sem sangria, em RGB, imagem de WhatsApp | Aprovação atrasa o lote inteiro |
| W5 | **Marca com pouca presença digital própria** (site institucional fraco; a loja oficial é de insumos/brindes) | Cliente não encontra "estamparia Praia Grande" no Google e cai no concorrente |
| W6 | **Pagamento manual** (PIX com comprovante enviado e validado à mão) | Risco de fraude de comprovante e tempo da equipe |
| W7 | **Fotos e mockups ainda genéricos** no MVP (imagens de exemplo, não fotos reais das peças) | Percepção de qualidade menor que a real |
| W8 | **Base técnica em JSON/arquivo** (MVP) e usuários de demonstração | Não pode ir para produção sem migração |
| W9 | **Catálogo de estampada e de revenda misturados** na cabeça do cliente | Dúvida "estou comprando a camiseta ou o serviço?" |

### 🔵 Oportunidades (externo · onde crescer)

| # | Oportunidade | Como o site aproveita |
|---|---|---|
| O1 | **Abadás, blocos, festas e eventos** na Baixada Santista (temporada forte de verão/carnaval) | Vitrine de estampa total + **data do lote visível** + urgência ("faltam N dias") |
| O2 | **Times amadores, escolinhas e academias** (uniforme com nome e número) | Extras "nome individual" e "número" já precificados no assistente |
| O3 | **Empresas e comércio local** (uniforme, brinde de fim de ano) | Página "para empresas" com CNPJ, nota e quantidade |
| O4 | **Escolas e formaturas** (camiseta de turma, infantil 2 a 14) | Grade infantil já no catálogo |
| O5 | **Revendedores** que já compram insumo na loja oficial e querem a peça pronta | Cruzar venda: "compre o liso no dstamp.com.br ou receba estampado aqui" |
| O6 | **SEO local** ("estamparia Praia Grande", "camiseta personalizada Santos", "abadá sob medida") | Página "Como funciona" + FAQ + conteúdo explicativo indexável |
| O7 | **Pedido recorrente** (time troca de patrocinador, empresa repõe uniforme) | Histórico do cliente no painel + reabrir pedido anterior |
| O8 | **Marketplaces** (Olist) já mapeados no MVP | Exportação CSV pronta |
| O9 | **Pix Automático / gateway de pagamento** | Elimina W6 (validação manual) |
| O10 | **Instagram/WhatsApp Business com catálogo linkado** | Botões de WhatsApp com mensagem pré-preenchida já existem no site |

### 🟠 Ameaças (externo · o que pode doer)

| # | Ameaça | Mitigação no site |
|---|---|---|
| T1 | **Concorrência de preço** de estamparias e marketplaces (Shopee/AliExpress em brindes) | Não competir em brinde barato: competir em **estampa total sem mínimo + prazo explicado** |
| T2 | **Estamparias de São Paulo capital** com prazo menor e frete barato | Mostrar a **data do lote** com transparência e priorizar cliente local (retirada) |
| T3 | **Custo de insumo** (papel, tinta, tecido) variando com câmbio | Tabela de preço editável no painel (admin) sem tocar em código |
| T4 | **Sazonalidade**: pico no verão/carnaval, ociosidade no inverno | Campanha de inverno (moletom/manga longa +R$5,50, corporativo) |
| T5 | **Cliente que some** depois do orçamento (orçamento no WhatsApp sem registro) | Pedido aberto no site + prazo de edição até a data do lote + cobrança automática |
| T6 | **Chargeback / comprovante falso** | Validação de comprovante com código REC + liberação só após autorizado |
| T7 | **Erro de produção em lote grande** (250 peças) | Chamados ERR numerados + ficha do designer por tipo de peça |
| T8 | **Dependência de plataforma de terceiros** (Nuvem Shop para a loja oficial) | Site próprio para o serviço de estamparia |

---

## 3. Cruzamento estratégico (o que fazer com isso)

| | **Forças** | **Fraquezas** |
|---|---|---|
| **Oportunidades** | **FO (atacar):** usar F1+F2+F3 para capturar O1–O4 com **preço visível e assistente guiado** — o cliente monta abadá/uniforme sozinho e entra no lote. | **FA (reforçar):** usar O6/O9 para eliminar W1 e W6 — pedido nasce no site (não no WhatsApp) e pagamento com gateway. |
| **Ameaças** | **FO (defender):** F2+F4+F7 como argumento contra T1/T2 — "sem mínimo, prazo honesto, arte aprovada por você". | **FA (corrigir):** atacar W2/W3 com **transparência de data** (próximo lote na home) e **antecipação de pedido** (urgência sem assustar). |

### Prioridades desta versão (decisões aplicadas)

1. **Foco total em estampa total.** Home, vitrine e checkout falam de camiseta, baby look, regata, regata feminina nadador, machão (camiseta sem manga), infantil e calça capoeira — **sem short**. É onde está a margem, a produção própria e a diferenciação (F1/F2/O1).
2. **Estampa localizada vira porta de entrada do WhatsApp.** Sublimação localizada e DTF (inclusive em peça de terceiros, canecas, garrafas e brindes) aparecem no site **com valores de referência e explicação técnica**, mas o fechamento é no WhatsApp — porque é um orçamento que depende de arte, cor da peça e tamanho da estampa.
3. **Checklist no lugar de formulário.** O cliente marca etapa por etapa (modelagem → tecido → gola → manga → tamanhos → arte → extras → dados → pagamento → revisar). Isso ataca W4 e T5: ninguém envia pedido incompleto.
4. **Camada explicativa ("Como funciona").** Uma página-guia com **15 blocos** (editáveis em Administração → Guia do site): o que é estampa total, Dry Fit × Poliflex, modelagens, tamanhos e preços por tamanho, formação de preço, prazo e lote, como funcionam os lotes, arte, pagamento, retirada/entrega, localizada, peça de terceiros, cuidados e trocas. Ataca W3, W9, T1 e alimenta O6 (SEO).
5. **Site 100% responsivo.** Mobile-first: menu hambúrguer, grade que vira 1 coluna, resumo do pedido fixo no rodapé no celular, **assistente com uma etapa por tela** (trilha de pontos + Próximo travado até completar), área da equipe com tabelas que rolam na horizontal.
6. **Mesmo modelo da loja oficial, só que estampada.** Vitrine em grade de produtos com preço "a partir de", página de produto, carrinho, checkout e acompanhamento — a diferença é que o produto é **a peça estampada sob encomenda**.

---

## 4. O que este site NÃO faz (por decisão)

- Não tenta substituir a loja oficial de insumos/lisos/brindes: ele **aponta** para dstamp.com.br.
- Não faz orçamento automático de estampa localizada (só referência + WhatsApp).
- Não edita arte online: a arte circula no WhatsApp e o site **indexa** a arte principal/final, as aprovações e as observações.
- Não trabalha com polo nem com algodão (fora do portfólio).
- Não impõe quantidade mínima (produção a partir de 1 peça).

---

## 5. Indicadores para acompanhar depois do lançamento

| Indicador | Meta inicial | Onde medir |
|---|---|---|
| Pedidos de estampa total abertos pelo site (não pelo WhatsApp) | ≥ 60% dos pedidos novos | Painel → Pedidos (origem) |
| Ocupação da janela semanal (250 peças) | 70–90% | Painel → dashboard (barra de capacidade) |
| Tempo entre pedido e arte aprovada | ≤ 2 dias | Linha do tempo do pedido |
| Pedidos com chamado ERR (erro de produção) | ≤ 2% | Painel → Chamados |
| Ticket médio estampa total | acompanhar | Painel → KPIs |
| Conversão WhatsApp ← página de localizada | acompanhar | cliques no botão (a implementar com UTM) |
| Comprovantes recusados | ≤ 5% | Painel → Comprovantes |

---

## 6. Riscos de execução desta versão

| Risco | Gravidade | Mitigação |
|---|---|---|
| Preços de modelagens novas (regata, baby look, nadador, machão, calça capoeira) ainda não confirmados pelo dono | Alta | Todos os produtos usam a **mesma tabela Dry Fit/Poliflex** com um campo **`delta`** (adicional por modelagem) editável no painel → **Administração → Catálogo** (coluna "Delta"). Hoje `delta = 0` — é a premissa mais importante a confirmar. |
| Datas de lote mudam toda semana | Média | Campo único `batch.nextDate` no Admin → Produção; todo o site recalcula |
| Fotos genéricas (W7) | Média | Trocar arquivos em `public/img/` mantendo os nomes, ou cadastrar `img` por produto no Admin → Catálogo |
| Banco em arquivo JSON (W8) | Alta para produção | Antes de publicar: migrar para MySQL/Postgres, remover usuários demo, desligar `DSTAMP_DEV` |
| Textos do guia escritos por mim, sem revisão do dono | Média | Editor em Administração → Guia do site: troca-se o conteúdo sem mexer no código |

---

## 7. Status da entrega (o que já está pronto e testado)

| Item | Status |
|---|---|
| Site responsivo (mobile-first, 640/980/1280 px + impressão) | ✅ pronto e verificado por teste |
| Assistente de 10 etapas, **uma por tela**, com trilha, travamento do "Próximo", rascunho salvo e etapas automáticas | ✅ pronto |
| Página "Como funciona" (15 blocos + 12 FAQ + 6 exemplos), editável no painel | ✅ pronto |
| Estampa localizada **só** com consulta ao WhatsApp (mensagem pronta) | ✅ pronto; a API recusa pedido self-service |
| Vitrine focada em estampa total (9 modelagens) + 26 itens "sob consulta" | ✅ pronto |
| Janela de 250 peças/semana (só estampa total) + lote de sábado (31/10) | ✅ pronto |
| Cliente vê **só a data + status** (sem barra, sem números, sem a palavra "semana"); contador de peças só para quem está logado (bloco do painel + faixa `.team-only` no site) | ✅ pronto |
| **Aba "Lotes"** no painel: os 6 sábados seguintes e a regra "o cliente não compra hoje para um lote futuro" | ✅ pronto |
| **Avisos do topo editáveis pelo admin** (texto + ativo), mostrados no site | ✅ pronto |
| Aviso de que **o prazo pode passar de 20 dias** em lote cheio | ✅ pronto (topo, cartão e carrinho) |
| Catálogo sem short + **calça capoeira** (infantil→GG R$ 55, EXG R$ 58) e **machão = camiseta sem manga** (imagem refeita) | ✅ pronto |
| Textos das páginas do cliente **reduzidos** (~20% menos caracteres na home; nada de "semana" ou contador) | ✅ pronto |
| Deploy: `PORT`/`HOST`/`DSTAMP_DATA`, modo produção sem dados demo, `/api/health`, Docker, backup | ✅ pronto (`DEPLOY.md`) |
| Motor de preço (faixas, gola V, manga longa, EXG→G6, extras, estampas, calça capoeira) | ✅ **179 verificações** automatizadas |
| Interface (landing, produto, assistente, localizada, guia, carrinho, acompanhamento, lotes, painel e administração) | ✅ **344 verificações** automatizadas (jsdom) |
| **Total** | **523 verificações, 0 falhas** |

**Premissa fechada nesta rodada:** os preços das modelagens além da camiseta **seguem os valores do exemplo** (`delta = 0`), para o dono navegar e validar o site — ver `PERGUNTAS-E-DECISOES.md`, pergunta 9.

**Aprendizado desta rodada (W novo):** *informação demais assusta o cliente.* O que era "mostrar tudo" virou "mostrar o necessário": data em vez de contador, uma etapa por vez em vez de acordeão longo, textos ~20% mais curtos e o detalhe técnico guardado no guia.
