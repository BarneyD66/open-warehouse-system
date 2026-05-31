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
