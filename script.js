
const cityInput = document.getElementById("cityInput");
const searchBtn = document.getElementById("searchBtn");
const weatherCard = document.getElementById("weatherCard");
const statusMessage = document.getElementById("statusMessage");
const loadingOverlay = document.getElementById("loadingOverlay");
const favoriteBtn = document.getElementById("favoriteBtn");
const favoriteList = document.getElementById("favoriteList");

const $ = id => document.getElementById(id);

let currentCity = "";
let favorites = JSON.parse(
    localStorage.getItem("aetherFavorites") || "[]"
);

let currentWeather = null;

$("currentDate").textContent = new Date().toLocaleDateString(
    "en-US",
    { weekday: "long", month: "long", day: "numeric" }
);

const weatherDescriptions = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Foggy",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Heavy drizzle",
    61: "Light rain",
    63: "Moderate rain",
    65: "Heavy rain",
    71: "Light snowfall",
    73: "Moderate snowfall",
    75: "Heavy snowfall",
    80: "Rain showers",
    81: "Moderate rain showers",
    82: "Heavy rain showers",
    95: "Thunderstorm",
    96: "Thunderstorm with hail",
    99: "Heavy thunderstorm"
};

function getDescription(code) {
    return weatherDescriptions[code] || "Weather unavailable";
}

function getIcon(code, isDay = 1) {
    const icons = {
        0: "01",
        1: "02",
        2: "03",
        3: "04",
        45: "50",
        48: "50",
        51: "09",
        53: "09",
        55: "09",
        61: "10",
        63: "10",
        65: "10",
        71: "13",
        73: "13",
        75: "13",
        80: "09",
        81: "09",
        82: "09",
        95: "11",
        96: "11",
        99: "11"
    };

    const suffix = isDay ? "d" : "n";
    return `https://openweathermap.org/img/wn/${icons[code] || "01"}${suffix}@2x.png`;
}

function showError(message) {
    statusMessage.textContent = message;
    statusMessage.classList.remove("hidden");
}

function hideError() {
    statusMessage.classList.add("hidden");
}

async function getWeather(city) {
    if (!city.trim()) {
        showError("Please enter a city name.");
        return;
    }

    loadingOverlay.classList.remove("hidden");
    hideError();

    try {
        const geoURL =
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;

        const geoResponse = await fetch(geoURL);

        if (!geoResponse.ok) {
            throw new Error("Unable to search for this city.");
        }

        const geoData = await geoResponse.json();

        if (!geoData.results || geoData.results.length === 0) {
            throw new Error("City not found. Try another city.");
        }

        const place = geoData.results[0];

        const locationName = place.name;
        const country = place.country || "";

        const params = new URLSearchParams({
            latitude: place.latitude,
            longitude: place.longitude,
            current: [
                "temperature_2m",
                "relative_humidity_2m",
                "apparent_temperature",
                "is_day",
                "precipitation",
                "weather_code",
                "wind_speed_10m",
                "surface_pressure"
            ].join(","),
            hourly: [
                "temperature_2m",
                "weather_code",
                "visibility"
            ].join(","),
            daily: [
                "weather_code",
                "temperature_2m_max",
                "temperature_2m_min",
                "sunrise",
                "sunset",
                "uv_index_max",
                "precipitation_probability_max"
            ].join(","),
            timezone: "auto",
            forecast_days: 6
        });

        const weatherURL =
            `https://api.open-meteo.com/v1/forecast?${params}`;

        const weatherResponse = await fetch(weatherURL);

        if (!weatherResponse.ok) {
            throw new Error("Unable to retrieve weather data.");
        }

        const data = await weatherResponse.json();

        currentCity = locationName;
        currentWeather = data;

        displayCurrentWeather(data, locationName, country);
        displayHourlyForecast(data);
        displayWeeklyForecast(data);
        displayHighlights(data);

        updateFavoriteButton();

        weatherCard.classList.remove("hidden");
        cityInput.value = "";

    } catch (error) {
        showError(error.message);
        weatherCard.classList.add("hidden");

    } finally {
        loadingOverlay.classList.add("hidden");
    }
}

function displayCurrentWeather(data, city, country) {
    const current = data.current;
    const code = current.weather_code;

    $("cityName").textContent =
        `${city}, ${country}`;

    $("weatherDate").textContent =
        new Date(current.time).toLocaleDateString(
            "en-US",
            {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric"
            }
        );

    $("temperature").innerHTML =
        `${Math.round(current.temperature_2m)}<span>°</span>`;

    $("description").textContent =
        getDescription(code);

    $("feelsLike").textContent =
        `Feels like ${Math.round(current.apparent_temperature)}°C`;

    $("weatherIcon").src =
        getIcon(code, current.is_day);

    $("weatherIcon").alt =
        getDescription(code);

    $("sunrise").textContent =
        data.daily.sunrise[0].split("T")[1];

    $("sunset").textContent =
        data.daily.sunset[0].split("T")[1];

    $("wind").textContent =
        `${current.wind_speed_10m} km/h`;

    $("humidity").textContent =
        `${current.relative_humidity_2m}%`;
}

function displayHighlights(data) {
    const current = data.current;
    const hourly = data.hourly;
    const daily = data.daily;

    const hourIndex = Math.max(
        0,
        hourly.time.findIndex(time => time >= current.time)
    );

    $("humidityDetail").innerHTML =
        `${current.relative_humidity_2m}<small>%</small>`;

    $("windDetail").innerHTML =
        `${current.wind_speed_10m}<small> km/h</small>`;

    $("pressure").innerHTML =
        `${Math.round(current.surface_pressure)}<small> hPa</small>`;

    $("visibility").innerHTML =
        `${(hourly.visibility[hourIndex] / 1000).toFixed(1)}<small> km</small>`;

    $("uvIndex").textContent =
        daily.uv_index_max[0] ?? "N/A";

    $("feelsDetail").innerHTML =
        `${Math.round(current.apparent_temperature)}<small>°C</small>`;
}

function displayHourlyForecast(data) {
    const container = $("hourlyForecast");
    container.innerHTML = "";

    const hours = data.hourly;
    let startIndex = hours.time.findIndex(
        time => time >= data.current.time
    );

    if (startIndex < 0) startIndex = 0;

    hours.time.slice(startIndex, startIndex + 6).forEach(
        (time, index) => {
            const position = startIndex + index;
            const code = hours.weather_code[position];

            const card = document.createElement("div");
            card.className = "hour-card";

            const timeLabel = index === 0
                ? "Now"
                : new Date(time).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit"
                });

            card.innerHTML = `
                <p class="hour-time">${timeLabel}</p>
                <img src="${getIcon(code)}" alt="${getDescription(code)}">
                <h3 class="hour-temp">
                    ${Math.round(hours.temperature_2m[position])}°
                </h3>
                <p class="hour-condition">
                    ${getDescription(code)}
                </p>
            `;

            container.appendChild(card);
        }
    );
}

function displayWeeklyForecast(data) {
    const container = $("weeklyForecast");
    container.innerHTML = "";

    const daily = data.daily;

    daily.time.slice(1, 6).forEach((date, index) => {
        const position = index + 1;
        const code = daily.weather_code[position];

        const day = new Date(date + "T12:00:00")
            .toLocaleDateString("en-US", {
                weekday: "long"
            });

        const row = document.createElement("div");
        row.className = "day-row";

        row.innerHTML = `
            <div class="day-name">${day}</div>

            <div class="day-condition">
                <img src="${getIcon(code)}" alt="${getDescription(code)}">
                ${getDescription(code)}
            </div>

            <div class="day-rain">
                💧 ${daily.precipitation_probability_max[position] ?? 0}%
            </div>

            <div class="day-temperature">
                ${Math.round(daily.temperature_2m_max[position])}°
                <span>${Math.round(daily.temperature_2m_min[position])}°</span>
            </div>
        `;

        container.appendChild(row);
    });
}

function saveFavorites() {
    localStorage.setItem(
        "aetherFavorites",
        JSON.stringify(favorites)
    );

    displayFavorites();
}

function displayFavorites() {
    favoriteList.innerHTML = "";

    if (favorites.length === 0) {
        favoriteList.innerHTML =
            '<p class="empty-favorites">No saved locations yet</p>';
        return;
    }

    favorites.forEach(city => {
        const item = document.createElement("div");
        item.className = "favorite-city";

        const nameButton = document.createElement("button");
        nameButton.className = "favorite-name";
        nameButton.textContent = `📍 ${city}`;

        nameButton.addEventListener("click", () => {
            getWeather(city);
        });

        const removeButton = document.createElement("button");
        removeButton.textContent = "×";

        removeButton.addEventListener("click", () => {
            favorites = favorites.filter(
                saved => saved.toLowerCase() !== city.toLowerCase()
            );

            saveFavorites();
            updateFavoriteButton();
        });

        item.append(nameButton, removeButton);
        favoriteList.appendChild(item);
    });
}

function updateFavoriteButton() {
    const isSaved = favorites.some(
        city => city.toLowerCase() === currentCity.toLowerCase()
    );

    favoriteBtn.classList.toggle("saved", isSaved);
    favoriteBtn.textContent = isSaved ? "♥" : "♡";
}

favoriteBtn.addEventListener("click", () => {
    if (!currentCity) return;

    const exists = favorites.some(
        city => city.toLowerCase() === currentCity.toLowerCase()
    );

    if (exists) {
        favorites = favorites.filter(
            city => city.toLowerCase() !== currentCity.toLowerCase()
        );
    } else {
        favorites.push(currentCity);
    }

    saveFavorites();
    updateFavoriteButton();
});

searchBtn.addEventListener("click", () => {
    getWeather(cityInput.value.trim());
});

cityInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
        getWeather(cityInput.value.trim());
    }
});

document.querySelectorAll(".nav-item").forEach(link => {
    link.addEventListener("click", () => {
        document.querySelectorAll(".nav-item").forEach(item => {
            item.classList.remove("active");
        });

        link.classList.add("active");
    });
});

displayFavorites();
getWeather("Dhaka");
