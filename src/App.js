document.addEventListener('DOMContentLoaded', () => {
    const stockForm = document.getElementById('stock-form');
    const tickerInput = document.getElementById('ticker-input');
    const errorMessage = document.getElementById('error-message');
    const chartTabs = document.getElementById('chart-tabs');

    const BACKEND_URL = 'https://netlify-render-bi-dashboard-ik3o.onrender.com'; // Replace with your deployed Render URL
    
    let priceChart = null;
    let updateInterval = null;
    let currentTicker = 'AAPL'; // Store the currently displayed ticker

    const state = {
        intradayData: null,
        dailyData: null,
    };

    const getStockData = async (ticker) => {
        showLoadingState();
        clearInterval(updateInterval);
        currentTicker = ticker;

        try {
            const response = await fetch(`${BACKEND_URL}/api/stock/${ticker}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `Error: ${response.statusText}`);
            }
            const data = await response.json();
            
            state.intradayData = data.chart_intraday;
            state.dailyData = null; // Reset daily data

            updateUI(data.profile, data.quote);
            renderChart('intraday'); // Render initial chart
            errorMessage.classList.add('hidden');

            updateInterval = setInterval(() => updatePrice(ticker), 30000);
        } catch (error) {
            console.error("Fetch Error:", error);
            errorMessage.textContent = error.message;
            errorMessage.classList.remove('hidden');
            document.getElementById('dashboard-content').classList.add('hidden');
        }
    };

    const updatePrice = async (ticker) => {
         try {
            const response = await fetch(`${BACKEND_URL}/api/quote/${ticker}`);
            if (!response.ok) return;
            const quoteData = await response.json();
            updatePriceDisplay(quoteData);
         } catch(e) {
             console.error("Failed to update price:", e);
         }
    };

    const showLoadingState = () => {
        document.getElementById('dashboard-content').classList.remove('hidden');
        document.querySelectorAll('.skeleton').forEach(el => el.style.display = 'block');
        document.getElementById('company-logo').classList.add('hidden');
        document.getElementById('chart-loader').style.display = 'flex';
        document.getElementById('price-chart').style.opacity = '0';
        
        document.getElementById('company-name').innerHTML = '<div class="skeleton h-8 w-48 bg-gray-700 rounded-md"></div>';
        document.getElementById('company-info').innerHTML = '<div class="skeleton h-5 w-32 bg-gray-700 rounded-md mt-2"></div>';
        document.getElementById('company-website').innerHTML = '<div class="skeleton h-5 w-40 bg-gray-700 rounded-md"></div>';
        document.getElementById('price-info').innerHTML = `<div class="skeleton h-10 w-3/4 bg-gray-700 rounded-md"></div><div class="skeleton h-6 w-1/2 bg-gray-700 rounded-md mt-3"></div>`;
        document.getElementById('key-metrics').innerHTML = `<div class="flex justify-between"><span class="text-gray-300">Volume:</span> <span class="skeleton h-5 w-20 bg-gray-700 rounded-md"></span></div><div class="flex justify-between"><span class="text-gray-300">Day High:</span> <span class="skeleton h-5 w-20 bg-gray-700 rounded-md"></span></div><div class="flex justify-between"><span class="text-gray-300">Day Low:</span> <span class="skeleton h-5 w-20 bg-gray-700 rounded-md"></span></div><div class="flex justify-between"><span class="text-gray-300">Market Cap:</span> <span class="skeleton h-5 w-20 bg-gray-700 rounded-md"></span></div>`;
    };

    const updateUI = (profile, quote) => {
        document.querySelectorAll('.skeleton').forEach(el => el.style.display = 'none');
        
        const logo = document.getElementById('company-logo');
        logo.src = profile.image;
        logo.onerror = () => { logo.src = `https://placehold.co/200x200/1f2937/ffffff?text=${profile.symbol}`; };
        logo.classList.remove('hidden');
        document.getElementById('company-logo-loader').style.display = 'none';

        document.getElementById('company-name').textContent = `${profile.companyName} (${profile.symbol})`;
        document.getElementById('company-info').textContent = `${profile.exchange}: ${profile.industry}`;
        const websiteLink = document.getElementById('company-website');
        websiteLink.href = profile.website;
        websiteLink.textContent = profile.website;

        updatePriceDisplay(quote);

        document.getElementById('key-metrics').innerHTML = `
            <div class="flex justify-between items-center"><span class="text-gray-300">Volume:</span> <span class="font-medium text-white">${(quote.volume || 0).toLocaleString()}</span></div>
            <div class="flex justify-between items-center"><span class="text-gray-300">Day High:</span> <span class="font-medium text-white">$${(quote.dayHigh || 0).toFixed(2)}</span></div>
            <div class="flex justify-between items-center"><span class="text-gray-300">Day Low:</span> <span class="font-medium text-white">$${(quote.dayLow || 0).toFixed(2)}</span></div>
            <div class="flex justify-between items-center"><span class="text-gray-300">Market Cap:</span> <span class="font-medium text-white">${(quote.marketCap || 0).toLocaleString()}</span></div>
        `;
    };

    const updatePriceDisplay = (quote) => {
        const price = (quote.price || 0).toFixed(2);
        const change = (parseFloat(quote.change) || 0);
        const changesPercentage = (parseFloat(quote.changesPercentage) || 0);
        const priceColor = change >= 0 ? 'price-up' : 'price-down';
        const sign = change >= 0 ? '+' : '';
        
        document.getElementById('price-info').innerHTML = `
            <p class="text-4xl font-bold text-white">${price}</p>
            <p class="text-lg font-medium ${priceColor} mt-1">${sign}${change.toFixed(2)} (${sign}${changesPercentage.toFixed(2)}%)</p>
        `;
    };

    const renderChart = async (timeframe) => {
        document.getElementById('chart-loader').style.display = 'flex';
        document.getElementById('price-chart').style.opacity = '0';
        
        let chartData, timeUnit;

        if (timeframe === 'intraday') {
            chartData = state.intradayData;
            timeUnit = 'hour';
        } else if (timeframe === 'daily') {
            if (!state.dailyData) {
                // Fetch daily data if not already in state
                const response = await fetch(`${BACKEND_URL}/api/historical/daily/${currentTicker}`);
                state.dailyData = await response.json();
            }
            chartData = state.dailyData;
            timeUnit = 'month';
        }

        if (!chartData || chartData.length === 0) {
            document.getElementById('chart-loader').innerHTML = '<div class="text-gray-400">No chart data available.</div>';
            return;
        }

        const ctx = document.getElementById('price-chart').getContext('2d');
        if (priceChart) priceChart.destroy();
        
        const reversedData = chartData.slice().reverse();
        const labels = reversedData.map(data => data.date);
        const dataPoints = reversedData.map(data => data.close);
        
        const chartColor = dataPoints[dataPoints.length - 1] >= dataPoints[0] ? '#22c55e' : '#ef4444';

        priceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Stock Price',
                    data: dataPoints,
                    borderColor: chartColor,
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.1,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { 
                        type: 'time',
                        time: { unit: timeUnit },
                        grid: { color: 'rgba(55, 65, 81, 0.5)' }, 
                        ticks: { color: '#9ca3af' } 
                    },
                    y: { 
                        position: 'right', 
                        grid: { color: 'rgba(55, 65, 81, 0.5)' }, 
                        ticks: { color: '#9ca3af', callback: (value) => '$' + value.toFixed(2) } 
                    }
                }
            }
        });

        document.getElementById('chart-loader').style.display = 'none';
        document.getElementById('price-chart').style.opacity = '1';
    };

    stockForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const ticker = tickerInput.value.trim().toUpperCase();
        if (ticker) {
            getStockData(ticker);
        }
    });

    chartTabs.addEventListener('click', (e) => {
        if (e.target.classList.contains('chart-tab-btn')) {
            const timeframe = e.target.dataset.timeframe;
            document.querySelector('.chart-tab-btn.active').classList.remove('active');
            e.target.classList.add('active');
            renderChart(timeframe);
        }
    });

    // Initial Load
    getStockData('AAPL');
});
