function calculateSimpleRevenue(purchase, product) {
    const discountMultiplier = 1 - (purchase.discount / 100);
    return purchase.sale_price * purchase.quantity * discountMultiplier;
}

function calculateBonusByProfit(index, total, seller) {
    const { profit } = seller;
    
    let bonusRate;
    if (index === 0) {
        bonusRate = 0.15;
    } else if (index === 1 || index === 2) {
        bonusRate = 0.10;
    } else if (index === total - 1) {
        bonusRate = 0;
    } else {
        bonusRate = 0.05;
    }
    
    return profit * bonusRate;
}

function analyzeSalesData(data, options) {
    if (!data
        || !Array.isArray(data.sellers)
        || !Array.isArray(data.products)
        || !Array.isArray(data.purchase_records)
        || data.sellers.length === 0
        || data.products.length === 0
        || data.purchase_records.length === 0
    ) {
        throw new Error('Некорректные входные данные');
    }

    if (typeof options !== "object" || options === null) {
        throw new Error('Опции должны быть объектом');
    }

    const { calculateRevenue, calculateBonus } = options;
    
    if (!calculateRevenue || !calculateBonus) {
        throw new Error('В опциях отсутствуют необходимые функции');
    }

    const sellerStats = data.sellers.map(seller => ({
        id: seller.id,
        name: `${seller.first_name} ${seller.last_name}`,
        revenue: 0,
        profit: 0,
        sales_count: 0,
        products_sold: {}
    }));

    const sellerIndex = {};
    sellerStats.forEach(seller => {
        sellerIndex[seller.id] = seller;
    });

    const productIndex = {};
    data.products.forEach(product => {
        productIndex[product.article] = product;
    });

    data.purchase_records.forEach(record => {
        const seller = sellerIndex[record.seller_id];
        if (!seller) return;
        
        record.items.forEach(item => {
            const product = productIndex[item.sku];
            if (!product) return;
            
            const revenue = calculateRevenue(item, product);
            const cost = product.cost_price * item.quantity;
            const profit = revenue - cost;
            
            seller.revenue += revenue;
            seller.profit += profit;
            seller.sales_count += item.quantity;
            
            if (!seller.products_sold[item.sku]) {
                seller.products_sold[item.sku] = 0;
            }
            seller.products_sold[item.sku] += item.quantity;
        });
    });

    const sellersWithSales = sellerStats.filter(seller => seller.sales_count > 0);
    sellersWithSales.sort((a, b) => b.profit - a.profit);

    const totalSellers = sellersWithSales.length;
    
    sellersWithSales.forEach((seller, index) => {
        seller.bonus = calculateBonus(index, totalSellers, seller);
    });

    return sellersWithSales.map(seller => {
        const topProducts = Object.entries(seller.products_sold)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([sku, quantity]) => ({
                sku,
                quantity
            }));

        return {
            seller_id: seller.id,
            name: seller.name,
            revenue: Number(seller.revenue.toFixed(2)),
            profit: Number(seller.profit.toFixed(2)),
            sales_count: seller.sales_count,
            bonus: Number(seller.bonus.toFixed(2)),
            top_products: topProducts
        };
    });
}