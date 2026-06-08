"use client";

import { ProfileProvider } from "@/context/profile-context";
import { NavProvider, useNav } from "@/context/nav-context";
import { Sidebar } from "@/components/sidebar";
import { DashboardSection } from "@/components/sections/dashboard-section";
import { EcsSection } from "@/components/sections/ecs-section";
import { EcrSection } from "@/components/sections/ecr-section";
import { NetworkingSection } from "@/components/sections/networking-section";
import { S3Section } from "@/components/sections/s3-section";
import { SecuritySection } from "@/components/sections/security-section";
import { WafSection } from "@/components/sections/waf-section";
import { CdnSection } from "@/components/sections/cdn-section";
import { ApiSection } from "@/components/sections/api-section";
import { StacksSection } from "@/components/stacks-section";
import { SettingsSection } from "@/components/sections/settings-section";
import { AccountsSection } from "@/components/sections/accounts-section";
import { CognitoSection } from "@/components/sections/cognito-section";
import { DynamoDbSection } from "@/components/sections/dynamodb-section";
import { LambdaSection } from "@/components/sections/lambda-section";
import { AmplifySection } from "@/components/sections/amplify-section";
import { CostAnalysisSection } from "@/components/sections/cost-analysis-section";
import { PushNotificationsSection } from "@/components/sections/push-notifications-section";

function MainContent() {
  const { section } = useNav();

  return (
    <main className="flex-1 overflow-y-auto p-6">
      <div className="max-w-7xl mx-auto">
        {section === "dashboard" && <DashboardSection />}
        {section === "ecs" && <EcsSection />}
        {section === "ecr" && <EcrSection />}
        {section === "networking" && <NetworkingSection />}
        {section === "s3" && <S3Section />}
        {section === "security" && <SecuritySection />}
        {section === "waf" && <WafSection />}
        {section === "cdn" && <CdnSection />}
        {section === "api" && <ApiSection />}
        {section === "stacks" && <StacksSection />}
        {section === "accounts" && <AccountsSection />}
        {section === "cognito" && <CognitoSection />}
        {section === "dynamodb" && <DynamoDbSection />}
        {section === "lambda" && <LambdaSection />}
        {section === "amplify" && <AmplifySection />}
        {section === "cost-analysis" && <CostAnalysisSection />}
        {section === "push-notifications" && <PushNotificationsSection />}
        {section === "settings" && <SettingsSection />}
      </div>
    </main>
  );
}

export default function Dashboard() {
  return (
    <ProfileProvider>
      <NavProvider>
        <div className="flex h-screen bg-background">
          <Sidebar />
          <MainContent />
        </div>
      </NavProvider>
    </ProfileProvider>
  );
}
