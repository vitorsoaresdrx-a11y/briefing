/**
 * Como a IA deve FAZER cada pergunta por voz.
 *
 * O formulário em texto usa `label` + `help` pensados para leitura; aqui vai
 * a versão para fala: autoexplicativa para quem não entende de tecnologia,
 * sem "selecione / marque / clique" (é uma ligação de voz, não tem botão).
 * A única exceção é oferecer a digitação ("pode ditar ou digitar aqui na
 * tela"), porque existe um campo de texto de apoio.
 *
 * Perguntas sem entrada aqui caem no `label` + `help` originais.
 */
export const VOICE_SAY: Record<string, string> = {
  name: "Pra começar: qual é o seu nome?",
  company: "E o nome da sua empresa ou marca? Se ainda não tem um definido, pode dizer o que pretende usar.",
  whatsapp: "Qual o seu WhatsApp, com DDD? É por onde vou falar com você sobre o projeto.",
  email: "E o seu melhor e-mail, aquele que você olha sempre?",
  current_site:
    "Você já tem um site no ar hoje? Se tiver, pode ditar o endereço pra mim ou digitar aqui na tela.",
  socials:
    "E as redes sociais da empresa — Instagram, Facebook, LinkedIn? Pode ditar os endereços ou digitar aqui na tela.",
  project_type:
    "O que você precisa construir? Uma landing page, um site institucional, um sistema com login, uma loja virtual, refazer um site que já existe, ou outra coisa?",
  niche:
    "Em qual segmento você atua? Saúde, jurídico, financeiro, educação, tecnologia, alimentação, varejo, serviços locais, imobiliário... qual se aproxima mais do seu negócio?",
  business_description:
    "Conta pra mim: o que a sua empresa faz, como se estivesse explicando pra um amigo?",
  differentiator: "E o que te diferencia? Por que alguém escolhe você e não o concorrente?",
  problem_solved: "Que problema você resolve pro seu cliente? Qual a dificuldade dele antes de te procurar?",
  main_goal:
    "Se o site fosse fazer uma coisa só muito bem, o que seria? Vender direto pelo site, captar contatos, agendar atendimentos, apresentar a empresa, ou validar uma ideia?",
  audience_type: "Seus clientes são outras empresas, consumidores finais, ou os dois?",
  audience_profile:
    "Descreve pra mim o seu cliente ideal: idade, profissão, estilo de vida, onde mora. Quanto mais detalhe, melhor.",
  age_range:
    "E a idade desses clientes, mais ou menos? Pode citar mais de uma faixa: de 18 a 24, 25 a 34, 35 a 44, 45 a 59, ou acima de 60.",
  region:
    "E onde esses clientes estão? Na sua cidade e região, no seu estado, no Brasil todo, ou até fora do Brasil?",
  has_logo: "Você já tem um logo, aquele símbolo ou nome estilizado da marca?",
  brand_colors:
    "Quais são as cores da sua marca? Se não tem nada definido, é só dizer que a gente sugere combinações.",
  brand_fonts:
    "Sua marca usa alguma fonte específica, algum tipo de letra? Se não sabe o que é isso, sem problema, a gente escolhe.",
  refs_liked:
    "Me fala até 3 sites que você acha bonitos, de qualquer área — pode ditar o endereço ou digitar aqui na tela.",
  refs_liked_why: "E o que te chama atenção nesses sites? As cores, a organização, as fotos, o clima...",
  ref_disliked:
    "E tem algum site que você não gosta, que acha feio ou confuso? Se lembrar de um, dita ou digita o endereço; se não, pode pular.",
  ref_disliked_why: "O que te incomoda nele? Muita informação junta, cores fortes, difícil de usar, parece antigo...",
  tone_formality: "De 0 a 100: 0 é uma marca super formal, 100 é super descontraída. Onde a sua fica?",
  tone_seriousness: "De 0 a 100: 0 é uma marca bem séria, 100 é bem divertida. Onde a sua fica?",
  tone_price: "De 0 a 100: 0 é luxo e exclusividade, 100 é acessível e próxima. Onde a sua fica?",
  sections:
    "O que você imagina no site? Por exemplo: página sobre, serviços, preços, depoimentos, portfólio, perguntas frequentes, blog, contato, equipe. Pode citar quantos quiser.",
  has_copy:
    "E os textos do site — você já tem prontos, tem uma parte, ou prefere que a gente escreva?",
  has_photos:
    "E as fotos? Você tem fotos boas, prefere usar banco de imagens, ou vai fotografar?",
  features:
    "E de funções, o que o site precisa ter? Por exemplo: botão de WhatsApp, formulário de contato, agendamento, pagamento online, chat... cita os que fizerem sentido.",
  integrations:
    "Você usa alguma ferramenta que o site precisaria conversar? Tipo e-mail marketing, agenda, meio de pagamento... se não usa nenhuma, pode pular.",
  has_domain:
    "Você já tem o endereço do site comprado, o domínio, tipo suaempresa ponto com ponto br?",
  domain_registrar:
    "E onde você comprou esse endereço? Tipo Registro ponto br, GoDaddy, Hostinger... se não lembrar, sem problema.",
  has_hosting:
    "E a hospedagem, o lugar onde o site fica guardado na internet — você já tem? Se não souber o que é, tudo bem, a gente cuida.",
  who_maintains:
    "Depois do site pronto, quem cuida dele? Você mesmo, ou prefere uma manutenção mensal com a gente?",
  deadline:
    "Pra quando você precisa do projeto? Urgente, em até um mês, dois a três meses, ou sem pressa?",
  deadline_date:
    "Tem alguma data específica em mente? Um lançamento, um evento... se não tem, pode pular.",
  budget:
    "E quanto você pretende investir, mais ou menos? Até 2 mil, de 2 a 5 mil, de 5 a 10 mil, acima de 10 mil — ou prefere conversar sobre isso depois?",
  competitors:
    "Quem são seus principais concorrentes? Se souber o site deles, dita ou digita aqui — não é pra copiar, é pra fazer você se destacar.",
  final_notes:
    "Pra fechar: tem mais alguma coisa que eu devia saber? Ideias, dúvidas, restrições, qualquer coisa que não coube antes.",
  saas_core_features:
    "O que a pessoa vai conseguir fazer dentro do sistema? Conta com suas palavras, sem tecnicês.",
  saas_user_types:
    "Que tipos de usuário vão usar? Por exemplo: administrador, funcionário, cliente...",
  saas_plans:
    "E como você pretende cobrar? Gratuito, versão grátis com paga, assinatura mensal, cobrança por uso, ou ainda não definiu?",
  saas_social_login:
    "Quer que as pessoas entrem com a conta do Google, num clique só, ou com login e senha normal?",
  saas_integrations:
    "O sistema precisa conversar com algum outro? Nota fiscal, pagamento no cartão, e-mail automático...",
  saas_stack_pref:
    "Tem alguma preferência de tecnologia? Só se você já souber — senão a gente escolhe a melhor.",
  ecom_product_count:
    "Quantos produtos você vai vender, mais ou menos? Até 20, de 20 a 100, de 100 a 500, ou mais de 500?",
  ecom_gateway:
    "E pra receber os pagamentos, o que você pretende usar? Pix, cartão, boleto, Mercado Pago, Stripe... pode citar mais de um.",
  ecom_shipping:
    "E a entrega, como vai ser? Correios ou transportadora, entrega local, retirada no local, ou é produto digital?",
  ecom_stock: "Como você controla o estoque hoje? Planilha, algum sistema, ou ainda não controla?",
  local_address: "Qual o endereço do negócio? Vai aparecer no site e no mapa pro cliente te encontrar.",
  local_hours: "E os horários de funcionamento?",
  local_area: "Quais regiões você atende? Cidade, bairros, um raio de entrega...",
  local_gmb:
    "Você tem a ficha da empresa no Google, aquela que aparece no Maps? Se não souber o que é, sem problema.",
  redesign_problems: "O que não funciona no seu site atual? O que te incomoda nele?",
  redesign_analytics:
    "Você tem acesso aos números de visita do site, o Google Analytics? Se não souber, tudo bem.",
  legal_notes:
    "Na sua área existem regras sobre divulgação na internet. Tem alguma restrição que eu precise respeitar? Se não souber, eu verifico.",
};
