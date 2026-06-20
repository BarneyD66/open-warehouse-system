export type NewsCategory = "industry" | "warehouse";

export type NewsArticle = {
  slug: string;
  date: string;
  category: NewsCategory;
  categoryLabel: string;
  categoryLabelEn: string;
  title: string;
  summary: string;
  image: string;
  sourceName: string;
  sourceUrl: string;
  readTime?: string;
  audience?: string;
  highlights?: string[];
  sections?: Array<{
    title: string;
    body: string[];
  }>;
  checklistTitle?: string;
  checklist?: string[];
  closingNote?: string;
  paragraphs: string[];
};

export const newsCategories = [
  { id: "industry", label: "行业新闻" },
  { id: "warehouse", label: "英国仓观察" },
] as const;

export const newsArticles: NewsArticle[] = [
  {
    slug: "amazon-northamptonshire-investment-2026-uk-fulfilment",
    date: "2026-06-10",
    category: "industry",
    categoryLabel: "行业新闻",
    categoryLabelEn: "Industry News",
    title: "Amazon 在 Northamptonshire 追加超 10 亿英镑投资后，英国卖家为何更要提前布局本地履约？",
    summary: "Amazon UK 于 2026 年 6 月 10 日宣布，将在 Northamptonshire 投资超 10 亿英镑并带来约 4,000 个岗位。对做 Amazon UK、FBA 中转和多平台履约的卖家来说，这说明英国本地仓配基础设施还在继续加码，前置备货和分批补货会更重要。",
    image: "https://assets.aboutamazon.com/dims4/default/2be2976/2147483647/strip/true/crop/1800x900+0+113/resize/1200x600!/quality/90/?url=https%3A%2F%2Famazon-blogs-brightspot.s3.amazonaws.com%2F65%2F2c%2F2aa53f8c4c0e9778ce4b48b50720%2Famazon-uk-total-tax-constribution-article-lead-image.png",
    sourceName: "About Amazon UK",
    sourceUrl: "https://www.aboutamazon.co.uk/news/job-creation-and-investment/amazon-invests-more-than-1-billion-in-northamptonshire-creating-4-000-jobs",
    readTime: "4 分钟阅读",
    audience: "适合在 Amazon UK 做补货、FBA 中转和英国本地一件代发的卖家",
    highlights: [
      "Amazon UK 明确继续追加本地物流与履约相关投资，英国市场对时效和仓配稳定性的要求还在上升。",
      "卖家如果只把库存压在单一渠道，旺季、促销或突发波峰时更容易同时遇到断货和周转失控。",
      "英国驿站可以先承接本地缓冲库存、贴标分箱和分批补 FBA，再把退货回流和异常件处理接上。",
    ],
    sections: [
      {
        title: "发生了什么",
        body: [
          "Amazon UK 于 2026 年 6 月 10 日宣布，将在 Northamptonshire 投资超过 10 亿英镑，并预计带来约 4,000 个就业岗位，继续扩大其在英国本地的运营与履约能力。",
        ],
      },
      {
        title: "对卖家意味着什么",
        body: [
          "平台持续投入英国本地基础设施，意味着买家对发货速度、补货稳定性和售后响应的预期还会继续提高。卖家如果继续依赖单点压货或临时补货，容易在活动期和日常订单之间出现库存错配。",
        ],
      },
      {
        title: "英国驿站能帮你解决什么",
        body: [
          "我们可以先在英国仓做前置备货和本地缓冲库存，再按 Amazon UK 销售节奏补 FBA 或处理本地订单；同时把到仓清点、换标分箱、退货质检和异常件回流接成一套流程，降低仓配波动带来的履约风险。",
        ],
      },
    ],
    paragraphs: [
      "Amazon 再次加码英国本地投资，释放出的信号很直接：英国履约网络还在往更密、更快、更稳定的方向走。对跨境卖家来说，这不只是平台新闻，更是备货和补货节奏需要跟着升级的提醒。",
      "如果库存全部压在单一仓点或单一渠道，一旦大促、秒杀或爆款波峰出现，断货、延迟补货和高成本移仓就会同时发生。更稳的做法，是把英国仓作为 FBA 前置缓冲层，让补货频率更细、库存决策更灵活。",
      "除了补货，退货与异常件也会直接影响利润。货先回到英国本地仓做质检、换标和二次可售判断，往往比直接放任平台退件沉没更可控。",
      "英国驿站能帮助卖家把前置备货、FBA 中转、本地派送和退货处理衔接起来，让仓配动作跟得上 Amazon UK 履约节奏持续抬高的趋势。",
    ],
  },
  {
    slug: "royal-mail-prices-2026-customs-update",
    date: "2026-07-01",
    category: "industry",
    categoryLabel: "行业新闻",
    categoryLabelEn: "Industry News",
    title: "Royal Mail 公布 2026 价目与欧盟关务更新后，英国仓发欧盟和本地尾程要注意什么？",
    summary: "Royal Mail 官网更新了 2026 年价格与欧盟贸易提示，明确 2026 年 7 月 1 日起对寄往欧盟且申报金额低于 150 欧元的包裹不再代收关税。对做英国仓发欧盟、退货回流和本地尾程的卖家来说，申报资料、税费方案和渠道分流都要提前准备。",
    image: "https://www.royalmail.com/sites/royalmail.com/files/styles/case_study/public/2019-05/ecommerce-online-parcel-delivery-customer-540x303.jpg?itok=iptPvb8J",
    sourceName: "Royal Mail 官方",
    sourceUrl: "https://www.royalmail.com/prices2026",
    readTime: "4 分钟阅读",
    audience: "适合用英国仓发欧盟订单、处理英国尾程和跨境退货的卖家",
    highlights: [
      "Royal Mail 在官网提示，2026 年 7 月 1 日起对低于 150 欧元的欧盟包裹不再代收进口关税。",
      "卖家不能只看尾程面价，还要同步确认申报金额、税费承担方式、退货回流和异常件处置口径。",
      "英国驿站可以先把欧盟申报资料、打包分流和退货处理流程标准化，降低规则变化带来的返工。",
    ],
    sections: [
      {
        title: "发生了什么",
        body: [
          "Royal Mail 官网在 2026 年价格更新页面提示，自 2026 年 7 月 1 日起，寄往欧盟且申报价值低于 150 欧元的包裹将不再由 Royal Mail 代收进口关税，卖家需要重新检查欧盟订单的税费和清关安排。",
        ],
      },
      {
        title: "对卖家意味着什么",
        body: [
          "如果卖家仍按旧口径处理欧盟订单，后续很容易在税费承担、清关延误、客户签收体验和退货成本上出现问题。对同时做 Amazon UK、独立站或 TikTok Shop 欧洲订单的卖家来说，渠道和税务规则分流会变得更重要。",
        ],
      },
      {
        title: "英国驿站能帮你解决什么",
        body: [
          "我们可以先在英国仓侧统一 SKU 申报资料、包装与分流规则，再按去向拆分本地尾程、欧盟跨境和退货回流处理；当规则变化时，卖家不需要临时重做整套仓配和售后流程。",
        ],
      },
    ],
    paragraphs: [
      "Royal Mail 这次更新，重点不只是价格表本身，而是它把欧盟低货值包裹的关税代收变化明确摆到了卖家面前。对从英国仓继续发欧盟订单的卖家来说，这会直接影响下单说明、税费策略和售后体验。",
      "很多卖家平时更关注尾程报价，但真正容易失控的是申报与清关细节。只要渠道、税费承担方式或申报资料没有提前统一，后面就可能出现延误、拒收和退货成本上升。",
      "更稳的做法，是在英国仓先把商品申报要素、包装口径、去向分流和异常件处理规则跑通。本地单继续走英国尾程，欧盟单按新的税费与清关要求单独配置，退货再回到本地仓统一处理。",
      "英国驿站可以把这套流程前置到仓配环节，帮助卖家在规则调整前就完成资料梳理、订单分流和退货回流准备，避免旺季前临时返工。",
    ],
  },
  {
    slug: "amazon-now-micro-fulfilment-expansion-2026-uk",
    date: "2026-06-04",
    category: "industry",
    categoryLabel: "行业新闻",
    categoryLabelEn: "Industry News",
    title: "Amazon Now 扩到曼城和伯明翰后，英国仓备货节奏为什么更要前置？",
    summary: "Amazon UK 宣布 Amazon Now 将扩展到曼彻斯特和伯明翰，并计划把英国微履约网络翻倍。对做 Amazon UK 与多渠道履约的卖家来说，前置备货、分仓补货和本地派送协同会变得更重要。",
    image: "https://assets.aboutamazon.com/ec/65/0f2c0a014c93bb4f886931420e38/amazonnow-01-new-version.jpg",
    sourceName: "About Amazon UK",
    sourceUrl: "https://www.aboutamazon.co.uk/news/retail/amazon-now",
    readTime: "4 分钟阅读",
    audience: "适合在 Amazon UK 做快周转 SKU、日用消费品和多平台履约的卖家",
    highlights: [
      "Amazon Now 计划把英国微履约网络从 10 个站点扩到更多城市，配送时效继续前压。",
      "平台越强调近仓与快送，卖家越需要把 UK 备货、补货和退货回流拆成可滚动执行的小节奏。",
      "英国驿站可以先做本地缓冲库存、分批补 FBA 或其他渠道，降低单仓压货和断货并存的风险。",
    ],
    sections: [
      {
        title: "发生了什么",
        body: [
          "Amazon UK 于 2026 年 6 月 4 日宣布，Amazon Now 后续将扩展到曼彻斯特和伯明翰，并计划把英国微履约网络规模翻倍，继续把高频商品放到离消费者更近的位置。",
        ],
      },
      {
        title: "对卖家意味着什么",
        body: [
          "当平台把“更近、更快”的履约能力继续往前推时，卖家不能只看前端流量，还要同步管住后端补货节奏。尤其是日用、快消、小家居这类复购型 SKU，如果全部库存一次性压到单一仓点，容易在促销与日常订单之间出现缺货、滞销同时发生。",
        ],
      },
      {
        title: "英国驿站能帮你解决什么",
        body: [
          "我们可以先在英国仓做本地缓冲库存，按周或按活动节奏分批补 FBA、补 Amazon 多渠道订单或一件代发渠道；同时把到仓清点、贴标分箱、异常件处理和退货回流记录统一起来，让快周转商品也能稳住时效和库存准确率。",
        ],
      },
    ],
    paragraphs: [
      "Amazon Now 扩到更多英国城市，核心信号不是“又多一个流量入口”，而是平台正在继续强化近仓履约和极速配送能力。卖家如果想跟上这种时效预期，库存和补货就不能再只靠大批量、低频率地一次性推进。",
      "对很多跨境卖家来说，更稳的方式是把英国仓当成库存缓冲层：货先到 UK，本地完成清点、分箱、贴标，再按销售变化滚动补到 Amazon 渠道或其他本地订单。",
      "这样做的好处是，活动期可以更快补货，平销期也不会因为 FBA 单点备货过重而压库存；一旦订单波峰过去，退货件和异常件也能回到本地仓做质检、重贴标和二次上架判断。",
      "英国驿站更适合承担这类“前置备货 + 分批补货 + 本地售后”的动作，让卖家在 Amazon UK 时效继续内卷时，仍然能把库存周转和履约成本控制在可预期范围内。",
    ],
  },
  {
    slug: "tiktok-booktok-live-uk-fulfilment-2026",
    date: "2026-06-04",
    category: "industry",
    categoryLabel: "行业新闻",
    categoryLabelEn: "Industry News",
    title: "TikTok 在英国加码 Shop LIVE 场景后，卖家该怎么准备瞬时爆单履约？",
    summary: "TikTok 宣布将与英国图书馆举办 BookTok Late，并在活动现场加入 TikTok Shop LIVE 销售装置。对做 TikTok Shop UK 的卖家来说，直播带来的短时订单峰值，会更考验英国本地备货、打包与退货处理能力。",
    image: "https://newsroom.tiktok.com/6a2141fd5a545d004b2833d4",
    sourceName: "TikTok Newsroom",
    sourceUrl: "https://newsroom.tiktok.com/introducing-booktok-late-at-the-british-library?lang=en-GB",
    readTime: "4 分钟阅读",
    audience: "适合在 TikTok Shop UK 做直播成交、内容种草和活动促销的卖家",
    highlights: [
      "TikTok 官方活动已把 TikTok Shop LIVE 直接嵌入英国线下文化场景，说明内容带货与实时成交仍在持续加码。",
      "直播订单的难点不只是起量，而是峰值后的打单、尾程、退货和库存回写是否跟得上。",
      "英国驿站可以把直播前备货、活动中出库和活动后退货回流连成一套动作，减少爆单后失控。",
    ],
    sections: [
      {
        title: "发生了什么",
        body: [
          "TikTok 于 2026 年 6 月 4 日宣布，将在 7 月 2 日与英国图书馆举办 BookTok Late 活动，并在现场设置 TikTok Shop LIVE 销售装置，支持用户边看内容边下单购买图书与限定版本。",
        ],
      },
      {
        title: "对卖家意味着什么",
        body: [
          "这类官方活动释放出的信号很明确：TikTok Shop UK 仍在继续强化“内容即货架、直播即成交”的模式。对卖家来说，真正拉开差距的往往不是一场直播卖多少，而是订单突然放大后，库存是否够、面单是否能及时生成、尾程是否稳定、退货能否快速回流。",
        ],
      },
      {
        title: "英国驿站能帮你解决什么",
        body: [
          "我们可以按活动前、中、后三段来配合：活动前先做 SKU 预打包与安全库存；活动中按平台订单批量出库、核对面单与异常；活动后把拒收、退货和二次可售件重新归集处理，避免直播流量吃掉毛利。",
        ],
      },
    ],
    paragraphs: [
      "TikTok 把 TikTok Shop LIVE 放进英国本地大型文化活动，本质上是在继续放大“内容场景触发成交”的能力。对卖家来说，这意味着订单波峰会更集中，履约链路必须提前准备，而不是等直播结束后再补动作。",
      "很多店铺在内容侧准备充分，但真正出问题的往往是仓配环节：库存没有提前分组，打包物料没备齐，订单批量导出和面单核对没有跑顺，结果爆单之后发货延迟、差评和退款一起出现。",
      "更稳的做法，是把 TikTok Shop 活动当成一次演练好的履约项目。先在英国仓锁定主推 SKU 的安全库存和包装口径，活动期间按批次出库，活动后再统一处理退货、换标和可售件回库。",
      "英国驿站能承接的价值，不只是把货发出去，而是帮助卖家把 TikTok Shop 的内容爆发，转换成可持续复制的本地履约流程。",
    ],
  },
  {
    slug: "tiktok-shop-europe-expansion-2026-uk-fulfillment",
    date: "2026-05-28",
    category: "industry",
    categoryLabel: "行业新闻",
    categoryLabelEn: "Industry News",
    title: "TikTok Shop 加速欧洲扩张后，英国仓如何支撑多站点履约？",
    summary: "TikTok Shop 宣布在欧洲新增站点与拓展计划后，卖家更需要用英国海外仓把备货、履约与退货处理“做成可复制的流程”。",
    image: "https://newsroom.tiktok.com/6a170f50505e58004b3631ec",
    sourceName: "TikTok Shop Newsroom",
    sourceUrl: "https://newsroom.tiktok.com/tiktok-shop-expands-across-europe",
    readTime: "5 分钟阅读",
    audience: "适合正在做 TikTok Shop UK/欧盟多站点布局的卖家",
    highlights: ["多站点扩张时，履约瓶颈往往来自“库存与退货”而非投放。", "英国仓可以作为库存缓冲层：先测品，再分配到 UK、本地派送或跨境。", "统一的退货质检/换标/二次上架流程，是降低售后损耗的关键。"],
    sections: [
      {
        title: "发生了什么",
        body: ["TikTok Shop 官方宣布扩展欧洲站点布局与增长计划，为跨境卖家带来更多站点机会，也意味着订单分布与履约要求更复杂。"],
      },
      {
        title: "对卖家意味着什么",
        body: ["当站点变多、爆品波动加大时，直接把全部库存压到单一渠道（或单一仓点）更容易出现缺货与滞销并存。更稳的做法是先在英国仓做小批量测试与滚动补货，再根据真实销量决定补 FBA、走本地尾程或跨境派送。"],
      },
      {
        title: "英国驿站能帮你解决什么",
        body: ["我们可以把 UK 备货拆成“到仓清点—贴标/分箱—一件代发/补 FBA—退货质检与再销售”几段流程，让每一票货的进度、异常与费用都可追溯；当你扩展到更多站点时，只需要复制同一套口径与资料要求即可。"],
      },
    ],
    paragraphs: [
      "TikTok Shop 宣布扩展欧洲站点与增长计划后，很多卖家会第一时间关注流量和上新节奏，但更容易踩坑的其实是履约：库存分散、补货节奏不稳、退货回流没有标准动作。",
      "站点越多，订单越分散，越需要一个“库存缓冲层”。把一部分货先放在英国海外仓，可以先按 SKU 做小批量测品与滚动补货：卖得动的款再补进 Amazon FBA 或持续做本地派送，卖得慢的款及时止损或调整包装与组合。",
      "另一个常被低估的环节是退货处理。欧洲多站点运营时，退货可能来自不同平台与不同标签规则；如果没有统一的质检、换标、再上架与记录口径，售后损耗会被放大。",
      "更稳的做法是把履约当成“可复制的流程”：到仓资料一次性统一，入库清点、贴标分箱、出库交接、退货处置都有记录。这样扩站点时不是从零开始，而是复制一套成熟的 UK 仓配动作。",
    ],
  },
  {
    slug: "eu-ucc-reforms-150-eur-duty-exemption-ends-2026",
    date: "2026-05-21",
    category: "industry",
    categoryLabel: "行业新闻",
    categoryLabelEn: "Industry News",
    title: "欧盟拟取消 150 欧元免税门槛：英国仓跨境发欧盟如何提前准备？",
    summary: "UK Government 更新的 EU UCC 改革解读提到：未来欧盟或将对 150 欧元以下包裹征收关税，卖家需要更早规划跨境清关与退货路线。",
    image: "https://cms-assets.publishing.service.gov.uk/media/67f923b6f70c932413afb606/campaign-europe.jpg",
    sourceName: "UK Government（business.gov.uk）",
    sourceUrl: "https://www.business.gov.uk/campaign/europe/european-union-eu-regulations/eu-ucc-reforms/",
    readTime: "6 分钟阅读",
    audience: "适合用英国仓发欧盟订单、或做 UK→EU 中转的卖家",
    highlights: ["如果免税门槛变化，低客单价跨境包裹的综合成本可能上升。", "提前把 HS/申报资料、DDP 方案与退货回流路线跑通，比临时改价更稳。", "英国仓可以把“合规资料与履约动作”标准化，减少扩站点的摩擦。"],
    sections: [
      {
        title: "政策背景（卖家需要关注的点）",
        body: ["business.gov.uk 的更新指出，EU UCC 改革可能会取消 150 欧元以下包裹的关税豁免，并强化跨境包裹的数据与合规要求。对做 UK→EU 派送的卖家来说，影响通常体现在成本结构与清关资料标准化上。"],
      },
      {
        title: "可能带来的履约变化",
        body: ["当“低价包裹更难靠免税吃红利”时，卖家更需要把履约做得可控：申报要素（HS、材质、用途、原产地）、DDP/税费方案、账单核对口径、以及退货回流后的再销售处理，最好在旺季前就跑通。"],
      },
      {
        title: "英国驿站能帮你做什么",
        body: ["我们支持在 UK 仓侧把商品资料与箱唛口径统一，按渠道要求打包贴标，并在退货回流后完成质检、换标与二次上架；同时配合你把跨境发欧盟的资料与异常处理流程固化下来，避免规则变化时全链路返工。"],
      },
    ],
    paragraphs: [
      "很多卖家用英国仓跨境发欧盟，本质上是把 UK 作为库存与履约缓冲层：UK 站点可以更快发货，欧盟订单也能用同一套库存体系滚动补货。",
      "但一旦欧盟对小额包裹的关税与数据要求收紧，最先受影响的往往是“低客单价单票利润”——同样的产品，税费、合规与尾程成本占比会更高。",
      "更稳的准备方式不是等政策落地再临时调价，而是提前把三件事跑通：商品资料（HS/申报要素）统一、清关与税费方案明确（例如 DDP 策略）、退货回流后的处置路径清晰（质检、换标、再上架或集中处理）。",
      "把这些动作固化到英国仓侧流程后，卖家在扩平台或扩站点时就能减少重复沟通，让履约在规则变化下仍然可控。",
    ],
  },
  {
    slug: "amazon-europe-2026-fba-fee-update",
    date: "2026-05-20",
    category: "industry",
    categoryLabel: "行业新闻",
    categoryLabelEn: "Industry News",
    title: "为什么 Amazon UK 卖家要用英国海外仓缓冲 FBA 补货？",
    summary: "平台费用、仓储费和退货相关费用变化后，卖家需要把 SKU、箱规、补货频率和英国本地暂存成本放在一起核算。",
    image: "https://assets.aboutamazon.com/dims4/default/7b9c2ed/2147483647/strip/true/crop/8482x4241+0+120/resize/1200x600!/quality/90/?url=https%3A%2F%2Famazon-blogs-brightspot.s3.amazonaws.com%2F2b%2F85%2Faf78238449f1adaf7e8050ba3f40%2Fadobestock-267952833.jpeg",
    sourceName: "Amazon 官方",
    sourceUrl: "https://www.aboutamazon.eu/news/empowering-small-business/update-to-european-referral-and-fulfilment-by-amazon-fees-for-2026",
    paragraphs: [
      "Amazon 欧洲站每次调整佣金、FBA 履约费、仓储费或退货相关费用，都会影响卖家的真实利润。对中国卖家来说，不能只看单票尾程价格，还要把备货周期、入仓预约、退货处置和库存周转一起算。",
      "如果 SKU 体积偏大、销量波动明显，全部库存直接压到 FBA 可能会带来更高的长期仓储和移除压力。把一部分货先放在英国本地仓，再按销售节奏补进 FBA，可以让库存更灵活，也方便处理平台退货和临时换标。",
      "比较稳妥的做法是先按 SKU 拆出三类：稳定热销款、测试款和季节款。热销款可以保持 FBA 安全库存，测试款和季节款则适合用英国仓小批量试仓，等数据跑出来后再决定是否加大补货。",
      "我们建议卖家在发第一批货前，先准备 SKU 清单、箱规、预计销量、平台要求和退货处理方式。这样报价不会只停留在运输价格，而是能提前判断仓储、贴标、分箱、打托、出库和异常处理的整体成本。",
    ],
  },
  {
    slug: "uk-last-mile-parcel-size-and-surcharge",
    date: "2026-05-18",
    category: "industry",
    categoryLabel: "行业新闻",
    categoryLabelEn: "Industry News",
    title: "英国海外仓一件代发为什么要先确认包裹尺寸？",
    summary: "Royal Mail 等承运商价格表会按重量、尺寸和服务类型区分，报价前先确认包裹规格，可以减少尾程报价和后续账单差异。",
    image: "https://www.royalmail.com/sites/royalmail.com/files/styles/case_study/public/2019-05/ecommerce-online-parcel-delivery-customer-540x303.jpg?itok=iptPvb8J",
    sourceName: "Royal Mail 官方",
    sourceUrl: "https://www.royalmail.com/business/prices",
    paragraphs: [
      "英国本地尾程并不是一个固定价格。不同承运商会按重量、尺寸、服务时效、签收要求、偏远地区和临时附加费来计费。卖家如果只提供产品名称，很难得到稳定报价。",
      "最容易产生差异的是包裹尺寸和重量。产品本身不大，但加上外箱、填充物和标签后，计费尺寸可能发生变化。尤其是家居、汽配、宠物用品和小家电，发货前需要先确认最终包装规格。",
      "对 TikTok Shop、eBay、Shopify 这类一件代发订单来说，尾程渠道选择会直接影响买家体验。便宜的渠道不一定适合所有品类，高客单价商品往往更需要签收、追踪和异常反馈。",
      "因此我们在报价前会优先确认：包裹长宽高、实际重量、是否易碎、是否需要签收、目标地区和预计订单量。信息越完整，后续账单和报价之间的差异就越容易控制。",
    ],
  },
  {
    slug: "tiktok-shop-uk-local-stock-testing",
    date: "2026-05-15",
    category: "industry",
    categoryLabel: "行业新闻",
    categoryLabelEn: "Industry News",
    title: "为什么越来越多 TikTok Shop 卖家开始用英国海外仓测品？",
    summary: "用英国仓做小批量测品，本质上是降低履约变量，让产品测试结果更接近真实需求。",
    image: "/assets/uk-station-hero-returns.png",
    sourceName: "TikTok 官方",
    sourceUrl: "https://newsroom.tiktok.com/tiktokshoplocalwinners?lang=en-GB",
    readTime: "6 分钟阅读",
    audience: "适合正在做 TikTok Shop UK 测品、内容投放和小批量备货的卖家",
    highlights: [
      "测品不只看点击率和广告转化，配送速度、退货体验和售后响应也会影响真实数据。",
      "先把少量库存放在英国本地仓，可以把履约变量降下来，更容易判断产品本身是否有需求。",
      "测出潜力后，海外仓模式可以自然切到补货、出库、退货和库存周转，不用临时重搭流程。",
    ],
    sections: [
      {
        title: "测品结果为什么会被履约影响？",
        body: [
          "很多 TikTok Shop 卖家早期会把测品理解成素材、达人和投流的问题：视频能不能爆、点击成本高不高、转化率够不够。但在英国本地用户的实际购买链路里，履约体验同样会进入反馈系统。",
          "如果商品页面承诺的时效和实际送达差距很大，用户可能在下单前犹豫，也可能在等待过程中取消。即使产品本身有吸引力，慢配送、追踪不清楚、退货路径复杂，都会让转化、评价和复购数据变得不干净。",
        ],
      },
      {
        title: "英国仓测品的核心，不是盲目压库存",
        body: [
          "用海外仓测品并不等于一开始就大批量备货。更稳的方式是先做一票小批量入仓：数量够跑出真实订单和售后反馈，但不把资金和库存全部压死。",
          "这票货的作用是验证一整条链路：入仓资料是否清楚、外箱和 SKU 是否容易识别、平台订单能不能及时出库、尾程渠道是否匹配品类、退货回来之后能否质检和重新上架。",
        ],
      },
      {
        title: "哪些品类更适合先用英国仓跑一轮？",
        body: [
          "客单价较高、体积重量影响尾程费用、退货率不确定、需要本地售后判断的品类，更适合先用英国仓小批量测试。比如家居用品、小家电、宠物用品、汽配件、服饰配件和带尺码选择的商品。",
          "这类商品如果直接从国内直发，用户收到货的时间、退货成本和异常沟通都会拉长。放到英国仓之后，卖家能更快看到真实下单意愿、退货原因和平台评价变化。",
        ],
      },
      {
        title: "从测品到放量，中间要留下哪些数据？",
        body: [
          "很多卖家测出订单后才开始补流程，结果会在放量时遇到箱规不清、标签不统一、出库规则不明、退货无法判断的问题。测品阶段就应该记录每个 SKU 的入仓数量、出库数量、尾程渠道、退货原因、可售率和异常处理方式。",
          "这些数据能帮助卖家判断下一批货是继续小批量测试，还是进入稳定补货；也能帮助仓库提前配置拣货、打包、贴标、质检和退货处理规则。",
        ],
      },
    ],
    checklistTitle: "一票货测品前，建议先准备",
    checklist: [
      "SKU 清单、产品图、箱数、每箱数量和外箱标签。",
      "预计上架平台、订单来源、是否需要平台面单或自有尾程账号。",
      "退货地址展示方式、退货质检标准、可售/不可售的处置规则。",
      "如果测品成功，下一批补货的预计数量、到仓时间和 FBA/本地发货比例。",
    ],
    closingNote: "测品阶段最重要的不是把流程做复杂，而是让每一次入仓、出库、退货和费用都能被追踪。这样卖家看到的数据才更接近真实市场，而不是被履约问题稀释后的结果。",
    paragraphs: [
      "过去测品，很多人理解是广告问题。现在越来越多人发现，履约本身也会影响测品结果。",
      "为什么？因为用户体验会影响数据反馈。配送慢，可能影响转化。售后差，可能影响复购。退货地址不清楚，也会影响店铺长期评分。",
      "这些都会干扰您判断产品本身表现。用英国海外仓测品，本质上是尽量减少履约变量，让产品测试结果更接近真实需求。",
      "另外还有一个现实原因。如果测出来产品有潜力，海外仓模式更容易顺势放量。不需要从零切换履约结构，也不用临时处理退货地址、换标、补货和库存周转。",
      "所以对一些卖家来说，海外仓不只服务成熟产品，也服务测试阶段。先用一票货验证流程，跑通入仓、出库、退货和费用，再决定要不要放大。",
    ],
  },
  {
    slug: "returns-relabel-and-refurbish-in-uk-warehouse",
    date: "2026-05-12",
    category: "warehouse",
    categoryLabel: "英国仓观察",
    categoryLabelEn: "UK Warehouse Insights",
    title: "英国海外仓退货处理怎么做？为什么越来越重要？",
    summary: "退货到本地仓后，先做质检拍照和处置判断，再决定重上架、转寄、维修翻新或销毁，减少不可见库存损耗。",
    image: "/assets/uk-warehouse-return-inspection.png",
    sourceName: "英国驿站总结",
    sourceUrl: "/news/returns-relabel-and-refurbish-in-uk-warehouse",
    paragraphs: [
      "跨境卖家最怕的不是退货本身，而是退货之后没有处理能力。货回到英国本地后，如果没有清点、拍照、质检和重新贴标流程，库存很容易变成看不见的损耗。",
      "退货处理的第一步不是马上重发，而是判断状态。包装是否完整，产品是否使用过，配件是否齐全，标签是否还能识别，这些信息决定后续能不能重新上架。",
      "对可售库存，可以换标、重新包装后回到库存。对轻微问题产品，可以做清洁、简单维修或翻新。对无法二次销售的产品，则需要转寄、集中处理或销毁。",
      "如果卖家同时做 Amazon、eBay、TikTok Shop 和独立站，退货处理还要考虑不同平台标签和库存归属。清晰的记录能够避免同一件货在多个渠道之间混乱流转。",
      "因此退货换标不是一个单独动作，而是一套售后库存管理流程。它能把退货从成本中心，尽量转回可处理、可核对、可再次销售的库存资产。",
    ],
  },
  {
    slug: "uk-warehouse-inbound-appointment-checklist",
    date: "2026-05-09",
    category: "warehouse",
    categoryLabel: "英国仓观察",
    categoryLabelEn: "UK Warehouse Insights",
    title: "第一次用英国海外仓，入库预约前要准备哪些资料？",
    summary: "入仓资料越完整，收货、清点、上架和后续出库越顺。SKU、箱唛、箱规和服务项目最好在到仓前统一。",
    image: "/assets/uk-station-hero-system.png",
    sourceName: "英国驿站运营观察",
    sourceUrl: "/news",
    paragraphs: [
      "很多入仓延误并不是发生在运输途中，而是发生在资料不完整的时候。仓库收到货以后，如果箱唛、SKU、数量、箱规和服务要求对不上，就需要反复确认，收货节奏会被打断。",
      "卖家在预约前最好准备四类信息：入仓批次号、每箱 SKU 和数量、外箱尺寸重量、到仓后需要做的服务项目。比如是否需要换标、贴 FBA 标签、拍照质检、暂存还是一件代发。",
      "如果货品要进入多个平台渠道，还要提前说明库存归属和标签规则。同一批货可能一部分去 FBA，一部分留在英国仓发本地订单，规则越早确定，后续越不容易混乱。",
      "我们的建议是把入仓预约当成一次流程确认，而不是单纯通知仓库有货要到。预约前把资料跑通，后面的清点、上架、库存同步和费用核对都会更顺。",
    ],
  },
  {
    slug: "fba-prep-label-and-carton-rules",
    date: "2026-05-06",
    category: "warehouse",
    categoryLabel: "英国仓观察",
    categoryLabelEn: "UK Warehouse Insights",
    title: "英国海外仓换标服务有什么用？哪些卖家会用到？",
    summary: "FBA 中转不是把货转送到 Amazon 仓那么简单，标签、箱规、预约和异常处理都会影响入仓效率。",
    image: "/assets/uk-station-hero-fba.png",
    sourceName: "英国驿站运营观察",
    sourceUrl: "/news",
    paragraphs: [
      "FBA 补仓看起来是一个物流动作，实际上包含一整套准备工作。卖家需要确认产品标签、外箱标签、箱内数量、混装规则、托盘要求和送仓预约信息。",
      "如果标签规则没有提前统一，货到英国仓后可能需要重新拆箱、核对、换标，既增加人工成本，也会影响送仓时效。尤其是多 SKU 混装、变体较多或季节性补货，更需要提前做清单。",
      "分箱和打托也不能临时决定。不同仓点、不同货量、不同运输方式，对外箱数量、重量和托盘规格的要求可能不同。补仓前先把这些口径锁定，能减少后续异常。",
      "更稳的做法是把 FBA 补仓拆成三个节点：到仓清点、FBA 准备、预约送仓。每个节点都有记录，卖家才知道货在哪、处理到哪一步、费用为什么产生。",
    ],
  },
  {
    slug: "multi-channel-stock-for-uk-sellers",
    date: "2026-05-03",
    category: "warehouse",
    categoryLabel: "英国仓观察",
    categoryLabelEn: "UK Warehouse Insights",
    title: "多平台卖家为什么需要英国海外仓做库存缓冲？",
    summary: "TikTok Shop、eBay、Amazon 和独立站同时运营时，本地仓可以作为库存缓冲层，统一处理补货、发货和退货。",
    image: "/assets/uk-warehouse-home-hero-v2.png",
    sourceName: "英国驿站运营观察",
    sourceUrl: "/news",
    paragraphs: [
      "多平台运营的难点不是多开几个店铺，而是库存被不同渠道切碎。一个平台缺货，另一个平台压货，退货又回到不同地址，最后卖家很难判断真实可售库存。",
      "英国仓的价值在于把库存先放在一个相对统一的缓冲层。卖家可以根据订单来源分配出库，也可以根据平台表现决定补 FBA、留本地发货，还是转给 B2B 客户。",
      "退货也可以回到同一个本地处理点，经过质检后再决定回到哪个渠道。这样库存不是单向消耗，而是可以被重新判断、重新分配。",
      "对正在扩平台的卖家来说，先建立统一库存和统一退货处理规则，比单纯追求某一个渠道的低价尾程更重要。",
    ],
  },
];

export function getNewsArticle(slug: string) {
  return newsArticles.find((article) => article.slug === slug);
}
